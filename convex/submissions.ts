import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireParticipant, viewerParticipant } from "./participants";
import { readSettings, takePrintNumber } from "./settings";
import { fileKindFromName, formatPrintCode } from "../lib/files";
import { MAX_SUBMISSIONS_PER_PARTICIPANT, submissionsAreOpen, type Dimensions } from "../lib/event";
import { fitsWithin, formatDimensions } from "../lib/dimensions";

export const MAX_TITLE_LENGTH = 60;
export const MAX_NOTES_LENGTH = 500;

type Submission = Doc<"submissions">;

const isActive = (s: Submission) => s.status !== "rejected";

async function ownSubmissions(ctx: MutationCtx, participantId: Id<"participants">) {
  return await ctx.db
    .query("submissions")
    .withIndex("by_participant", (q) => q.eq("participantId", participantId))
    .collect();
}

// Loads a submission the viewer owns; anyone else gets the same "not found".
async function requireOwnSubmission(ctx: MutationCtx, id: Id<"submissions">) {
  const participant = await requireParticipant(ctx);
  const submission = await ctx.db.get(id);
  if (!submission || submission.participantId !== participant._id) {
    throw new Error("Submission not found");
  }
  return { participant, submission };
}

function requireEditable(submission: Submission) {
  if (submission.status !== "submitted") {
    throw new Error("This upload has been reviewed and can't be changed");
  }
}

// The entry can only move while none of the participant's active uploads has
// been accepted into the queue.
function choiceLocked(submissions: Submission[]) {
  return submissions.some((s) => isActive(s) && s.status !== "submitted");
}

function hasPrintFailedReplacement(submissions: Submission[]) {
  const active = submissions.filter(isActive);
  if (active.some((submission) => submission.printRequested)) return false;
  return submissions.some(
    (rejected) =>
      rejected.status === "rejected" &&
      rejected.rejectionKind === "print_failed" &&
      rejected.rejectedAt !== undefined &&
      !active.some((submission) => submission._creationTime > rejected.rejectedAt!)
  );
}

function cleanTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Give your keychain a title");
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new Error(`Title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }
  return trimmed;
}

function cleanNotes(notes: string | undefined) {
  const trimmed = notes?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer`);
  }
  return trimmed;
}

// Empty means "any colour".
function cleanColour(colour: string | undefined, allowed: string[]) {
  const trimmed = colour?.trim();
  if (!trimmed) return undefined;
  const match = allowed.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (!match) throw new Error("Pick a colour from the list");
  return match;
}

function cleanDimensions(d: Dimensions, max: Dimensions): Dimensions {
  const values = [d.x, d.y, d.z];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("We couldn't measure that model, try exporting it again");
  }
  if (!fitsWithin(d, max)) {
    throw new Error(`Your model is ${formatDimensions(d)}; the limit is ${formatDimensions(max)}`);
  }
  return { x: d.x, y: d.y, z: d.z };
}

async function requireSubmissionsOpen(ctx: MutationCtx) {
  const settings = await readSettings(ctx);
  if (!submissionsAreOpen(settings, Date.now())) throw new Error("Submissions are closed");
  return settings;
}

async function assertCanUpload(ctx: MutationCtx, participantId: Id<"participants">) {
  const settings = await readSettings(ctx);
  const submissions = await ownSubmissions(ctx, participantId);
  const active = submissions.filter(isActive);
  if (!submissionsAreOpen(settings, Date.now()) && !hasPrintFailedReplacement(submissions)) {
    throw new Error("Submissions are closed");
  }
  if (active.length >= MAX_SUBMISSIONS_PER_PARTICIPANT) {
    throw new Error(`You can have at most ${MAX_SUBMISSIONS_PER_PARTICIPANT} active uploads`);
  }
  return { settings, active };
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const participant = await requireParticipant(ctx);
    await assertCanUpload(ctx, participant._id);
    return await ctx.storage.generateUploadUrl();
  },
});

export type CreateResult = { ok: true; id: Id<"submissions"> } | { ok: false; error: string };

// Validation failures return an error instead of throwing so the uploaded
// blob's deletion commits rather than rolling back with the transaction.
export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    title: v.string(),
    notes: v.optional(v.string()),
    colour: v.optional(v.string()),
    originalFileName: v.string(),
    dimensionsMm: v.object({ x: v.number(), y: v.number(), z: v.number() }),
  },
  handler: async (ctx, args): Promise<CreateResult> => {
    const participant = await requireParticipant(ctx);
    const file = await ctx.db.system.get(args.storageId);
    if (!file) return { ok: false, error: "Upload not found, try again" };
    const alreadyUsed = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .first();
    if (alreadyUsed) return { ok: false, error: "That file has already been submitted" };

    try {
      const { settings, active } = await assertCanUpload(ctx, participant._id);
      const kind = fileKindFromName(args.originalFileName);
      if (!kind) throw new Error("Only STL or 3MF files are accepted");
      if (file.size > settings.maxFileBytes) {
        const mb = Math.round(settings.maxFileBytes / (1024 * 1024));
        throw new Error(`Files must be ${mb} MB or smaller`);
      }
      const dimensionsMm = cleanDimensions(args.dimensionsMm, settings.maxDimensionsMm);
      const title = cleanTitle(args.title);
      const notes = cleanNotes(args.notes);
      const colour = cleanColour(args.colour, settings.colours);
      const printCode = formatPrintCode(await takePrintNumber(ctx));
      const id = await ctx.db.insert("submissions", {
        participantId: participant._id,
        storageId: args.storageId,
        originalFileName: args.originalFileName.trim().slice(0, 200),
        kind,
        sizeBytes: file.size,
        title,
        notes,
        colour,
        dimensionsMm,
        // A fresh upload fills a vacant entry; an existing upload is never
        // promoted without the participant choosing it.
        printRequested: !active.some((s) => s.printRequested),
        status: "submitted",
        printCode,
      });
      return { ok: true, id };
    } catch (e) {
      await ctx.storage.delete(args.storageId);
      return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
    }
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const participant = await viewerParticipant(ctx);
    if (!participant) return null;
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
      .collect();
    const locked = choiceLocked(submissions);
    const canUploadReplacement = hasPrintFailedReplacement(submissions);
    return await Promise.all(
      submissions.map(async (s) => {
        let queuePosition: number | null = null;
        if (s.status === "queued" && s.queueOrder !== undefined) {
          const ahead = await ctx.db
            .query("submissions")
            .withIndex("by_status_queueOrder", (q) =>
              q.eq("status", "queued").lt("queueOrder", s.queueOrder!)
            )
            .collect();
          queuePosition = ahead.length + 1;
        }
        return {
          _id: s._id,
          _creationTime: s._creationTime,
          printCode: s.printCode,
          title: s.title,
          notes: s.notes,
          colour: s.colour,
          kind: s.kind,
          sizeBytes: s.sizeBytes,
          originalFileName: s.originalFileName,
          printRequested: s.printRequested,
          status: s.status,
          rejectionReason: s.rejectionReason,
          rejectionKind: s.rejectionKind,
          dimensionsMm: s.dimensionsMm,
          canUploadReplacement,
          queuePosition,
          editable: s.status === "submitted",
          canChoose: s.status === "submitted" && !locked,
          fileUrl: await ctx.storage.getUrl(s.storageId),
        };
      })
    );
  },
});

export const setPrintRequested = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, { id }) => {
    const { participant, submission } = await requireOwnSubmission(ctx, id);
    requireEditable(submission);
    const all = await ownSubmissions(ctx, participant._id);
    if (choiceLocked(all)) throw new Error("Your entry is locked in");
    // Picking a vacant entry (after a rejection) is always allowed; swapping
    // an existing one only while submissions are open.
    if (all.some((s) => isActive(s) && s.printRequested)) await requireSubmissionsOpen(ctx);
    for (const s of all) {
      const want = s._id === id;
      if (s.printRequested !== want) await ctx.db.patch(s._id, { printRequested: want });
    }
  },
});

export const update = mutation({
  args: {
    id: v.id("submissions"),
    title: v.string(),
    notes: v.optional(v.string()),
    colour: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { submission } = await requireOwnSubmission(ctx, args.id);
    requireEditable(submission);
    const settings = await requireSubmissionsOpen(ctx);
    await ctx.db.patch(submission._id, {
      title: cleanTitle(args.title),
      notes: cleanNotes(args.notes),
      colour: cleanColour(args.colour, settings.colours),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, { id }) => {
    const { participant, submission } = await requireOwnSubmission(ctx, id);
    requireEditable(submission);
    await ctx.db.delete(submission._id);
    await ctx.storage.delete(submission.storageId);
    if (submission.printRequested) {
      const next = (await ownSubmissions(ctx, participant._id)).find(isActive);
      if (next) await ctx.db.patch(next._id, { printRequested: true });
    }
  },
});
