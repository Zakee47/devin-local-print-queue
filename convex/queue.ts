import { internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { viewerRole, requireAdmin } from "./admins";
import { downloadFileName } from "../lib/files";
import { MAX_SUBMISSIONS_PER_PARTICIPANT, type Printer } from "../lib/event";
import { fitsWithin } from "../lib/dimensions";
import { readSettings, type Settings } from "./settings";
import { previewUrlOf } from "./submissions";

const PIPELINE: Doc<"submissions">["status"][] = ["queued", "printing", "done"];

export function printersWithColour(printers: Printer[], colour?: string): string[] {
  const requested = colour?.trim().toLowerCase();
  if (!requested) return printers.map(({ name }) => name);
  return printers
    .filter(({ colours }) => colours.some((loaded) => loaded.trim().toLowerCase() === requested))
    .map(({ name }) => name);
}

function requireKnownPrinter(settings: Settings, name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  const printer = settings.printers.find(
    ({ name: configuredName }) => configuredName.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (!printer) throw new ConvexError(`Unknown printer "${trimmed}"`);
  return printer.name;
}

async function load(ctx: MutationCtx, id: Id<"submissions">) {
  const submission = await ctx.db.get(id);
  if (!submission) throw new ConvexError("Submission not found");
  return submission;
}

async function audit(
  ctx: MutationCtx,
  actor: string,
  action: string,
  submissionId: Id<"submissions">,
  detail?: string
) {
  await ctx.db.insert("auditLog", { actor, action, submissionId, detail });
}

function expectStatus(submission: Doc<"submissions">, ...allowed: Doc<"submissions">["status"][]) {
  if (!allowed.includes(submission.status)) {
    throw new ConvexError(`${submission.printCode} is ${submission.status}, expected ${allowed.join(" or ")}`);
  }
}

async function nextQueueOrder(ctx: MutationCtx) {
  const last = await ctx.db
    .query("submissions")
    .withIndex("by_status_queueOrder", (q) => q.eq("status", "queued"))
    .order("desc")
    .first();
  return (last?.queueOrder ?? 0) + 1;
}

// Every submission with its participant and a preview URL, for the board.
export const board = query({
  args: {},
  handler: async (ctx) => {
    const role = await viewerRole(ctx);
    if (!role) throw new ConvexError("Not an admin");
    const settings = await readSettings(ctx);
    const isOwner = role === "owner";
    const submissions = await ctx.db.query("submissions").collect();
    const participants = new Map<Id<"participants">, Doc<"participants"> | null>();
    const rows = [];
    for (const s of submissions) {
      if (!participants.has(s.participantId)) {
        participants.set(s.participantId, await ctx.db.get(s.participantId));
      }
      const participant = participants.get(s.participantId);
      const participantName = participant?.name ?? "Unknown";
      const participantUsername = participant?.displayName ?? "Unknown";
      const oversize = s.dimensionsMm ? !fitsWithin(s.dimensionsMm, settings.maxDimensionsMm) : false;
      const printersWithRequestedColour = printersWithColour(settings.printers, s.colour);
      const matchingPrinters = new Set(printersWithRequestedColour);
      rows.push({
        ...s,
        participantUsername,
        participantName,
        ...(isOwner ? { participantEmail: participant?.email ?? "" } : {}),
        printersWithColour: printersWithRequestedColour,
        printerOptions: [
          ...printersWithRequestedColour,
          ...settings.printers.filter(({ name }) => !matchingPrinters.has(name)).map(({ name }) => name),
        ],
        oversize,
        fileUrl: await ctx.storage.getUrl(s.storageId),
        previewUrl: await previewUrlOf(ctx, s),
        downloadName: downloadFileName({
          printCode: s.printCode,
          participantName,
          colour: s.colour,
          title: s.title,
          kind: s.kind,
        }),
      });
    }
    return rows;
  },
});

export const counts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const count = async (status: Doc<"submissions">["status"]) =>
      (
        await ctx.db
          .query("submissions")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()
      ).length;
    const submitted = await ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect();
    return {
      review: submitted.filter((s) => s.printRequested).length,
      queued: await count("queued"),
      printing: await count("printing"),
      done: await count("done"),
    };
  },
});

// submitted → queued. Approving a backup file makes it the participant's print.
export const approve = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, { id }) => {
    const actor = await requireAdmin(ctx);
    const submission = await load(ctx, id);
    expectStatus(submission, "submitted");
    const siblings = await ctx.db
      .query("submissions")
      .withIndex("by_participant", (q) => q.eq("participantId", submission.participantId))
      .collect();
    const inPipeline = siblings.find((s) => s._id !== id && PIPELINE.includes(s.status));
    if (inPipeline) {
      throw new ConvexError(`This participant already has ${inPipeline.printCode} ${inPipeline.status}`);
    }
    for (const s of siblings) {
      if (s._id !== id && s.printRequested) await ctx.db.patch(s._id, { printRequested: false });
    }
    await ctx.db.patch(id, {
      status: "queued",
      printRequested: true,
      queueOrder: await nextQueueOrder(ctx),
      queuedAt: Date.now(),
      reviewedBy: actor,
      rejectionReason: undefined,
      rejectionKind: undefined,
    });
    await audit(ctx, actor, "queue.approve", id);
  },
});

export const startPrinting = mutation({
  args: { id: v.id("submissions"), printer: v.optional(v.string()) },
  handler: async (ctx, { id, printer }) => {
    const actor = await requireAdmin(ctx);
    expectStatus(await load(ctx, id), "queued");
    const resolved = requireKnownPrinter(await readSettings(ctx), printer);
    await ctx.db.patch(id, { status: "printing", printingAt: Date.now(), printer: resolved });
    await audit(ctx, actor, "queue.startPrinting", id, resolved);
  },
});

export const setPrinter = mutation({
  args: { id: v.id("submissions"), printer: v.optional(v.string()) },
  handler: async (ctx, { id, printer }) => {
    const actor = await requireAdmin(ctx);
    const submission = await load(ctx, id);
    expectStatus(submission, "printing", "done");
    const resolved = requireKnownPrinter(await readSettings(ctx), printer);
    await ctx.db.patch(id, { printer: resolved });
    await audit(ctx, actor, "queue.setPrinter", id, resolved ?? "cleared");
  },
});

export const markDone = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, { id }) => {
    const actor = await requireAdmin(ctx);
    expectStatus(await load(ctx, id), "printing");
    await ctx.db.patch(id, { status: "done", doneAt: Date.now() });
    await audit(ctx, actor, "queue.markDone", id);
  },
});

export const reject = mutation({
  args: { id: v.id("submissions"), reason: v.string() },
  handler: async (ctx, { id, reason }) => {
    const actor = await requireAdmin(ctx);
    const trimmed = reason.trim();
    if (!trimmed) throw new ConvexError("A rejection comment is required");
    expectStatus(await load(ctx, id), "submitted", "queued");
    await ctx.db.patch(id, {
      status: "rejected",
      rejectionReason: trimmed,
      rejectedAt: Date.now(),
      reviewedBy: actor,
      printRequested: false,
      queueOrder: undefined,
      rejectionKind: "review",
    });
    await audit(ctx, actor, "queue.reject", id, trimmed);
  },
});

export const printFailed = mutation({
  args: { id: v.id("submissions"), reason: v.string() },
  handler: async (ctx, { id, reason }) => {
    const actor = await requireAdmin(ctx);
    const trimmed = reason.trim();
    if (!trimmed) throw new ConvexError("A reason is required");
    const submission = await load(ctx, id);
    expectStatus(submission, "printing");
    await ctx.db.patch(id, {
      status: "rejected",
      rejectionKind: "print_failed",
      rejectionReason: trimmed,
      rejectedAt: Date.now(),
      reviewedBy: actor,
      printRequested: false,
      queueOrder: undefined,
    });
    await audit(ctx, actor, "queue.printFailed", id, trimmed);
  },
});

// Undo one step: done → printing → queued → submitted, rejected → submitted.
export const moveBack = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, { id }) => {
    const actor = await requireAdmin(ctx);
    const submission = await load(ctx, id);
    switch (submission.status) {
      case "done":
        await ctx.db.patch(id, { status: "printing", doneAt: undefined });
        break;
      case "printing":
        await ctx.db.patch(id, {
          status: "queued",
          printingAt: undefined,
          printer: undefined,
          queueOrder: submission.queueOrder ?? (await nextQueueOrder(ctx)),
        });
        break;
      case "queued":
        await ctx.db.patch(id, { status: "submitted", queueOrder: undefined, queuedAt: undefined });
        break;
      case "rejected": {
        const active = (
          await ctx.db
            .query("submissions")
            .withIndex("by_participant", (q) => q.eq("participantId", submission.participantId))
            .collect()
        ).filter((s) => s.status !== "rejected");
        if (active.length >= MAX_SUBMISSIONS_PER_PARTICIPANT) {
          throw new ConvexError("This participant already has the maximum active submissions");
        }
        await ctx.db.patch(id, {
          status: "submitted",
          rejectionReason: undefined,
          rejectionKind: undefined,
          rejectedAt: undefined,
          printRequested: !active.some((s) => s.printRequested),
        });
        break;
      }
      default:
        throw new ConvexError(`${submission.printCode} is already awaiting review`);
    }
    await audit(ctx, actor, "queue.moveBack", id, `from ${submission.status}`);
  },
});

// Swaps a queued submission with its neighbour in the print order.
export const move = mutation({
  args: { id: v.id("submissions"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { id, direction }) => {
    const actor = await requireAdmin(ctx);
    const submission = await load(ctx, id);
    expectStatus(submission, "queued");
    const order = submission.queueOrder ?? 0;
    const neighbour = await ctx.db
      .query("submissions")
      .withIndex("by_status_queueOrder", (q) =>
        direction === "up"
          ? q.eq("status", "queued").lt("queueOrder", order)
          : q.eq("status", "queued").gt("queueOrder", order)
      )
      .order(direction === "up" ? "desc" : "asc")
      .first();
    if (!neighbour) return;
    await ctx.db.patch(id, { queueOrder: neighbour.queueOrder });
    await ctx.db.patch(neighbour._id, { queueOrder: order });
    await audit(ctx, actor, "queue.move", id, direction);
  },
});

function submissionDownloadName(submission: Doc<"submissions">, participantName: string) {
  return downloadFileName({
    printCode: submission.printCode,
    participantName,
    colour: submission.colour,
    title: submission.title,
    kind: submission.kind,
  });
}

// Used by the /download HTTP action; throws unless the caller is an admin.
export const downloadInfo = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const submissionId = ctx.db.normalizeId("submissions", id);
    const submission = submissionId ? await ctx.db.get(submissionId) : null;
    if (!submission) return null;
    const participant = await ctx.db.get(submission.participantId);
    return {
      storageId: submission.storageId,
      fileName: submissionDownloadName(submission, participant?.name ?? "unknown"),
    };
  },
});

// Every submission flattened for the CSV/zip export; staff and owner. No
// storage ids or URLs — the client fetches files through /download.
export const exportRows = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const submissions = await ctx.db.query("submissions").collect();
    submissions.sort((a, b) => a.printCode.localeCompare(b.printCode));
    const participants = new Map<Id<"participants">, Doc<"participants"> | null>();
    const rows = [];
    for (const s of submissions) {
      if (!participants.has(s.participantId)) {
        participants.set(s.participantId, await ctx.db.get(s.participantId));
      }
      const participant = participants.get(s.participantId);
      const likes = (
        await ctx.db
          .query("likes")
          .withIndex("by_submission", (q) => q.eq("submissionId", s._id))
          .collect()
      ).filter((like) => like.reaction === "like").length;
      const votes = (
        await ctx.db
          .query("votes")
          .withIndex("by_submission", (q) => q.eq("submissionId", s._id))
          .collect()
      ).length;
      rows.push({
        id: s._id,
        downloadName: submissionDownloadName(s, participant?.name ?? "unknown"),
        printCode: s.printCode,
        title: s.title,
        username: participant?.displayName ?? "Unknown",
        name: participant?.name ?? "Unknown",
        email: participant?.email ?? "",
        colour: s.colour ?? "",
        status: s.status,
        printer: s.printer ?? "",
        printRequested: s.printRequested,
        likes,
        votes,
        rejectionReason: s.rejectionReason ?? "",
        createdAt: s._creationTime,
      });
    }
    return rows;
  },
});
