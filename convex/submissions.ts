import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { requireParticipant, viewerParticipant } from "./participants";
import { requireAdmin, viewerRole } from "./admins";
import { readSettings, takePrintNumber } from "./settings";
import { fileKindFromName, formatPrintCode } from "../lib/files";
import { MAX_SUBMISSIONS_PER_PARTICIPANT, submissionsAreOpen, type Dimensions } from "../lib/event";
import { fitsWithin, formatDimensions } from "../lib/dimensions";
import { isPreviewImage, MAX_PREVIEW_BYTES } from "../lib/preview-image";
import { currentVersion, isActive, isDeleted, isDesignEntry } from "./entries";
import { planRoles, roleOf, rolesOf, type RoleFile } from "../lib/roles";

export const MAX_TITLE_LENGTH = 60;
export const MAX_NOTES_LENGTH = 500;

type Submission = Doc<"submissions">;

async function ownSubmissions(ctx: MutationCtx, participantId: Id<"participants">) {
  return await ctx.db
    .query("submissions")
    .withIndex("by_participant", (q) => q.eq("participantId", participantId))
    .collect();
}

export async function storageReferenced(ctx: MutationCtx, storageId: Id<"_storage">) {
  const submission = await ctx.db
    .query("submissions")
    .filter((q) =>
      q.or(
        q.eq(q.field("storageId"), storageId),
        q.eq(q.field("previewStorageId"), storageId)
      )
    )
    .first();
  if (submission) return true;
  return Boolean(
    await ctx.db
      .query("submissionVersions")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first()
  ) || Boolean(
    await ctx.db
      .query("submissionVersions")
      .withIndex("by_previewStorageId", (q) => q.eq("previewStorageId", storageId))
      .first()
  );
}

export async function previewUrlOf(ctx: QueryCtx, submission: Doc<"submissions">): Promise<string | null> {
  return submission.previewStorageId ? await ctx.storage.getUrl(submission.previewStorageId) : null;
}

async function deleteIfOrphan(ctx: MutationCtx, storageId: Id<"_storage">) {
  if (!(await storageReferenced(ctx, storageId)) && (await ctx.db.system.get("_storage", storageId))) {
    await ctx.storage.delete(storageId);
  }
}

async function stagePreview(
  ctx: MutationCtx,
  submissionId: Id<"submissions">,
  previewStorageId: Id<"_storage">,
  version: number
) {
  if (await storageReferenced(ctx, previewStorageId)) return;
  const meta = await ctx.db.system.get("_storage", previewStorageId);
  if (!meta) return;
  if (meta.size > MAX_PREVIEW_BYTES) {
    await ctx.storage.delete(previewStorageId);
    return;
  }
  await ctx.scheduler.runAfter(0, internal.submissions.verifyPreview, {
    submissionId,
    previewStorageId,
    version,
  });
}

export const verifyPreview = internalAction({
  args: {
    submissionId: v.id("submissions"),
    previewStorageId: v.id("_storage"),
    version: v.number(),
  },
  handler: async (ctx, { submissionId, previewStorageId, version }) => {
    const blob = await ctx.storage.get(previewStorageId);
    if (!blob) return;
    const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    if (blob.size > MAX_PREVIEW_BYTES || !isPreviewImage(bytes)) {
      await ctx.storage.delete(previewStorageId);
      return;
    }
    await ctx.runMutation(internal.submissions.attachPreview, {
      submissionId,
      previewStorageId,
      version,
    });
  },
});

export const attachPreview = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    previewStorageId: v.id("_storage"),
    version: v.number(),
  },
  handler: async (ctx, { submissionId, previewStorageId, version }) => {
    const submission = await ctx.db.get(submissionId);
    if (!submission || isDeleted(submission) || currentVersion(submission) !== version) {
      await deleteIfOrphan(ctx, previewStorageId);
      return;
    }
    const old = submission.previewStorageId;
    await ctx.db.patch(submissionId, { previewStorageId });
    if (old && old !== previewStorageId) await deleteIfOrphan(ctx, old);
  },
});

export const generatePreviewUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    if (!(await viewerRole(ctx))) await requireParticipant(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Loads a submission the viewer owns; anyone else gets the same "not found".
async function requireOwnSubmission(ctx: MutationCtx, id: Id<"submissions">) {
  const participant = await requireParticipant(ctx);
  const submission = await ctx.db.get(id);
  if (!submission || submission.participantId !== participant._id) {
    throw new ConvexError("Submission not found");
  }
  return { participant, submission };
}

function requireEditable(submission: Submission) {
  if (submission.status !== "submitted") {
    throw new ConvexError("This upload has been reviewed and can't be changed");
  }
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
  if (!trimmed) throw new ConvexError("Give your keychain a title");
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new ConvexError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }
  return trimmed;
}

function cleanNotes(notes: string | undefined) {
  const trimmed = notes?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw new ConvexError(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer`);
  }
  return trimmed;
}

// Empty means "any colour".
function cleanColour(colour: string | undefined, allowed: string[]) {
  const trimmed = colour?.trim();
  if (!trimmed) return undefined;
  const match = allowed.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (!match) throw new ConvexError("Pick a colour from the list");
  return match;
}

function cleanDimensions(d: Dimensions, max: Dimensions): Dimensions {
  const values = [d.x, d.y, d.z];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new ConvexError("We couldn't measure that model, try exporting it again");
  }
  if (!fitsWithin(d, max)) {
    throw new ConvexError(`Your model is ${formatDimensions(d)}; the limit is ${formatDimensions(max)}`);
  }
  return { x: d.x, y: d.y, z: d.z };
}

async function requireSubmissionsOpen(ctx: MutationCtx) {
  const settings = await readSettings(ctx);
  if (!submissionsAreOpen(settings, Date.now())) throw new ConvexError("Submissions are closed");
  return settings;
}

async function assertCanUpload(ctx: MutationCtx, participantId: Id<"participants">) {
  const settings = await readSettings(ctx);
  const submissions = await ownSubmissions(ctx, participantId);
  const active = submissions.filter(isActive);
  if (!submissionsAreOpen(settings, Date.now()) && !hasPrintFailedReplacement(submissions)) {
    throw new ConvexError("Submissions are closed");
  }
  if (active.length >= MAX_SUBMISSIONS_PER_PARTICIPANT) {
    throw new ConvexError(`You can have at most ${MAX_SUBMISSIONS_PER_PARTICIPANT} active uploads`);
  }
  return { settings, active };
}

function roleFiles(submissions: Submission[]): RoleFile[] {
  return submissions.filter(isActive).map((submission) => ({
    id: submission._id,
    printCode: submission.printCode,
    vote: isDesignEntry(submission),
    print: submission.printRequested,
    status: submission.status,
    designRemoved: submission.designRemoved ?? false,
  }));
}

function roleLabel(roles: { vote: boolean; print: boolean }) {
  const role = roleOf(roles);
  return role === "both" ? "Vote+Print" : role === "vote" ? "Vote" : role === "print" ? "Print" : "No role";
}

function requireReplaceable(submission: Submission) {
  if (submission.status === "printing") {
    throw new ConvexError(`${submission.printCode} is printing. Ask staff for changes.`);
  }
  if (submission.status === "done") {
    throw new ConvexError(`${submission.printCode} has been printed. Ask staff for changes.`);
  }
  if (!isActive(submission)) throw new ConvexError("Only active uploads can be replaced");
}

function withdrawnFields(version: number, now: number, kind: "withdrawn" | "replaced") {
  return {
    status: "submitted" as const,
    queueOrder: undefined,
    queuedAt: undefined,
    printer: undefined,
    printingAt: undefined,
    reviewedBy: undefined,
    participantNotice: { kind, version, at: now },
  };
}

async function auditParticipant(
  ctx: MutationCtx,
  participant: Doc<"participants">,
  action: string,
  submissionId: Id<"submissions">,
  detail?: string
) {
  await ctx.db.insert("auditLog", {
    actor: participant.email,
    action,
    submissionId,
    detail,
  });
}

async function applyOtherRoles(
  ctx: MutationCtx,
  participant: Doc<"participants">,
  plan: Extract<ReturnType<typeof planRoles>, { ok: true }>,
  targetPrintCode: string
) {
  const now = Date.now();
  for (const other of plan.others) {
    const id = other.id as Id<"submissions">;
    const current = await ctx.db.get(id);
    if (!current) continue;
    const roles = { vote: other.vote, print: other.print };
    const fields = { designEntry: other.vote, printRequested: other.print };
    const patch = other.withdrawsPrint
      ? { ...fields, ...withdrawnFields(currentVersion(current), now, "withdrawn") }
      : fields;
    await ctx.db.patch(id, patch);
    if (other.withdrawsPrint) {
      await auditParticipant(ctx, participant, "queue.withdrawn", id, "print removed");
    }
    const relinquished = [
      ...(isDesignEntry(current) && !other.vote ? ["Vote"] : []),
      ...(current.printRequested && !other.print ? ["Print"] : []),
    ];
    const detail = other.swapped
      ? `${roleLabel(roles)} (swapped with ${targetPrintCode})`
      : `${roleLabel(roles)}${relinquished.length ? ` (moved ${relinquished.join(" and ")} to ${targetPrintCode})` : ""}`;
    await auditParticipant(
      ctx,
      participant,
      "participant.roles",
      id,
      detail
    );
  }
}

export const generateUploadUrl = mutation({
  args: { replaceId: v.optional(v.id("submissions")) },
  handler: async (ctx, { replaceId }) => {
    const participant = await requireParticipant(ctx);
    if (replaceId) {
      const submission = await ctx.db.get(replaceId);
      if (!submission || submission.participantId !== participant._id || isDeleted(submission)) {
        throw new ConvexError("Submission not found");
      }
      requireReplaceable(submission);
      await requireSubmissionsOpen(ctx);
    } else {
      await assertCanUpload(ctx, participant._id);
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export type CreateResult =
  | { ok: true; id: Id<"submissions">; printCode: string }
  | { ok: false; error: string };

// Validation failures return an error instead of throwing so the uploaded
// blob's deletion commits rather than rolling back with the transaction.
export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    previewStorageId: v.optional(v.id("_storage")),
    title: v.string(),
    notes: v.optional(v.string()),
    colour: v.optional(v.string()),
    originalFileName: v.string(),
    dimensionsMm: v.object({ x: v.number(), y: v.number(), z: v.number() }),
    role: v.union(v.literal("vote"), v.literal("print"), v.literal("both")),
  },
  handler: async (ctx, args): Promise<CreateResult> => {
    const participant = await requireParticipant(ctx);
    const file = await ctx.db.system.get(args.storageId);
    if (!file) {
      if (args.previewStorageId && args.previewStorageId !== args.storageId) {
        await deleteIfOrphan(ctx, args.previewStorageId);
      }
      return { ok: false, error: "Upload not found, try again" };
    }
    if (await storageReferenced(ctx, args.storageId)) {
      if (args.previewStorageId && args.previewStorageId !== args.storageId) {
        await deleteIfOrphan(ctx, args.previewStorageId);
      }
      return { ok: false, error: "That file has already been submitted" };
    }

    let settings: Awaited<ReturnType<typeof readSettings>>;
    let active: Submission[];
    let kind: NonNullable<ReturnType<typeof fileKindFromName>>;
    let dimensionsMm: Dimensions;
    let title: string;
    let notes: string | undefined;
    let colour: string | undefined;
    let plan: Extract<ReturnType<typeof planRoles>, { ok: true }>;
    try {
      ({ settings, active } = await assertCanUpload(ctx, participant._id));
      const detectedKind = fileKindFromName(args.originalFileName);
      if (!detectedKind) throw new ConvexError("Only STL or 3MF files are accepted");
      kind = detectedKind;
      if (file.size > settings.maxFileBytes) {
        const mb = Math.round(settings.maxFileBytes / (1024 * 1024));
        throw new ConvexError(`Files must be ${mb} MB or smaller`);
      }
      dimensionsMm = cleanDimensions(args.dimensionsMm, settings.maxDimensionsMm);
      title = cleanTitle(args.title);
      notes = cleanNotes(args.notes);
      colour = cleanColour(args.colour, settings.colours);
      const planned = planRoles(roleFiles(active), null, args.role);
      if (!planned.ok) throw new ConvexError(planned.reason);
      plan = planned;
      if (
        !submissionsAreOpen(settings, Date.now()) &&
        (args.role !== "print" || plan.others.length > 0)
      ) {
        throw new ConvexError("Submissions are closed, so you can only upload a replacement print");
      }
    } catch (e) {
      await deleteIfOrphan(ctx, args.storageId);
      if (args.previewStorageId && args.previewStorageId !== args.storageId) {
        await deleteIfOrphan(ctx, args.previewStorageId);
      }
      return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
    }

    const printCode = formatPrintCode(await takePrintNumber(ctx));
    await applyOtherRoles(ctx, participant, plan, printCode);
    const selected = rolesOf(args.role);
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
      printRequested: selected.print,
      designEntry: selected.vote,
      status: "submitted",
      printCode,
      version: 1,
    });
    await auditParticipant(
      ctx,
      participant,
      "participant.upload",
      id,
      args.role === "both" ? "Vote+Print" : args.role === "vote" ? "Vote" : "Print"
    );
    if (args.previewStorageId && args.previewStorageId !== args.storageId) {
      await stagePreview(ctx, id, args.previewStorageId, 1);
    }
    return { ok: true, id, printCode };
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
    const visible = submissions.filter((submission) => !isDeleted(submission));
    const canUploadReplacement = hasPrintFailedReplacement(visible);
    const settings = await readSettings(ctx);
    return await Promise.all(
      visible.map(async (s) => {
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
          designEntry: isDesignEntry(s),
          vote: isDesignEntry(s),
          print: s.printRequested,
          version: currentVersion(s),
          active: isActive(s),
          designRemoved: s.designRemoved ?? false,
          designRemovedReason: s.designRemoved ? s.designRemovedReason : undefined,
          status: s.status,
          rejectionReason: s.rejectionReason,
          rejectionKind: s.rejectionKind,
          dimensionsMm: s.dimensionsMm,
          canUploadReplacement,
          queuePosition,
          editable: s.status === "submitted",
          changeable:
            submissionsAreOpen(settings, Date.now()) &&
            s.status !== "printing" &&
            s.status !== "done" &&
            !isDeleted(s),
          lockedReason: !submissionsAreOpen(settings, Date.now())
            ? "Submissions are closed. Ask staff to change this file."
            : s.status === "printing"
              ? `${s.printCode} is printing. Ask staff for changes.`
              : s.status === "done"
                ? `${s.printCode} has been printed. Ask staff for changes.`
                : null,
          fileUrl: await ctx.storage.getUrl(s.storageId),
          previewUrl: await previewUrlOf(ctx, s),
        };
      })
    );
  },
});

export const setRoles = mutation({
  args: { id: v.id("submissions"), role: v.union(v.literal("vote"), v.literal("print"), v.literal("both")) },
  handler: async (ctx, { id, role }) => {
    const { participant, submission } = await requireOwnSubmission(ctx, id);
    if (isDeleted(submission)) throw new ConvexError("Submission not found");
    await requireSubmissionsOpen(ctx);
    if (!isActive(submission)) throw new ConvexError("Only active uploads can change role");
    const all = await ownSubmissions(ctx, participant._id);
    const files = roleFiles(all);
    const plan = planRoles(files, id, role);
    if (!plan.ok) throw new ConvexError(plan.reason);
    if (isDesignEntry(submission) === plan.vote && submission.printRequested === plan.print && !plan.others.length) {
      return;
    }
    await applyOtherRoles(ctx, participant, plan, submission.printCode);
    const fields = { designEntry: plan.vote, printRequested: plan.print };
    if (plan.withdrawsPrint) {
      await ctx.db.patch(id, { ...fields, ...withdrawnFields(currentVersion(submission), Date.now(), "withdrawn") });
      await auditParticipant(ctx, participant, "queue.withdrawn", id, "print removed");
    } else {
      await ctx.db.patch(id, fields);
    }
    const moved = plan.others.flatMap((other) => [
      ...(files.find((file) => file.id === other.id)?.vote && plan.vote
        ? [`Vote from ${other.printCode}`]
        : []),
      ...(files.find((file) => file.id === other.id)?.print && plan.print
        ? [`Print from ${other.printCode}`]
        : []),
    ]);
    const swappedWith = plan.others.filter((other) => other.swapped).map((other) => other.printCode);
    const detail = swappedWith.length
      ? `${roleLabel({ vote: plan.vote, print: plan.print })} (swapped with ${swappedWith.join(", ")})`
      : `${roleLabel({ vote: plan.vote, print: plan.print })}${moved.length ? ` (moved ${moved.join(" and ")})` : ""}`;
    await auditParticipant(
      ctx,
      participant,
      "participant.roles",
      id,
      detail
    );
  },
});

export const colourDemand = query({
  args: {},
  handler: async (ctx) => {
    const [submitted, queued] = await Promise.all(
      (["submitted", "queued"] as const).map((status) =>
        ctx.db
          .query("submissions")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()
      )
    );
    const byColour = new Map<string, { colour: string | null; waiting: number }>();
    for (const submission of [...submitted, ...queued]) {
      if (isDeleted(submission)) continue;
      const colour = submission.colour?.trim() || null;
      const key = colour?.toLowerCase() ?? "";
      const current = byColour.get(key);
      if (current) current.waiting += 1;
      else byColour.set(key, { colour, waiting: 1 });
    }
    return [...byColour.values()].sort((a, b) =>
      (a.colour ?? "").localeCompare(b.colour ?? "")
    );
  },
});

export const update = mutation({
  args: {
    id: v.id("submissions"),
    title: v.string(),
    notes: v.optional(v.string()),
    colour: v.optional(v.string()),
    previewStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { submission } = await requireOwnSubmission(ctx, args.id);
    if (isDeleted(submission)) throw new ConvexError("Submission not found");
    requireEditable(submission);
    const settings = await requireSubmissionsOpen(ctx);
    await ctx.db.patch(submission._id, {
      title: cleanTitle(args.title),
      notes: cleanNotes(args.notes),
      colour: cleanColour(args.colour, settings.colours),
    });
    await auditParticipant(ctx, (await requireParticipant(ctx)), "participant.update", submission._id);
    if (args.previewStorageId) {
      await stagePreview(ctx, submission._id, args.previewStorageId, currentVersion(submission));
    }
  },
});

type FileVersion = Pick<
  Doc<"submissions">,
  "storageId" | "previewStorageId" | "originalFileName" | "kind" | "sizeBytes" | "dimensionsMm"
>;

export async function applyFile(
  ctx: MutationCtx,
  submission: Submission,
  file: FileVersion,
  why: "replaced" | "restored"
) {
  const now = Date.now();
  const version = currentVersion(submission);
  const nextVersion = version + 1;
  await ctx.db.insert("submissionVersions", {
    submissionId: submission._id,
    version,
    storageId: submission.storageId,
    previewStorageId: submission.previewStorageId,
    originalFileName: submission.originalFileName,
    kind: submission.kind,
    sizeBytes: submission.sizeBytes,
    dimensionsMm: submission.dimensionsMm,
    archivedAt: now,
    why,
  });
  const leftQueue = submission.status === "queued";
  const patch: Partial<Submission> = {
    ...file,
    version: nextVersion,
  };
  if (leftQueue) {
    Object.assign(patch, {
      status: "submitted",
      queueOrder: undefined,
      queuedAt: undefined,
      printer: undefined,
      printingAt: undefined,
      reviewedBy: undefined,
    });
  }
  if (submission.status === "rejected") {
    Object.assign(patch, {
      status: "submitted",
      rejectionReason: undefined,
      rejectionKind: undefined,
      rejectedAt: undefined,
      reviewedBy: undefined,
    });
  }
  if (why === "replaced" && submission.printRequested && leftQueue) {
    patch.participantNotice = { kind: "replaced", version: nextVersion, at: now };
  } else if (why === "restored") {
    patch.participantNotice = { kind: "restored", version: nextVersion, at: now };
  }
  await ctx.db.patch(submission._id, patch);
  return { version: nextVersion, leftQueue };
}

export const replaceFile = mutation({
  args: {
    id: v.id("submissions"),
    storageId: v.id("_storage"),
    previewStorageId: v.optional(v.id("_storage")),
    originalFileName: v.string(),
    dimensionsMm: v.object({ x: v.number(), y: v.number(), z: v.number() }),
  },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; error: string }> => {
    const participant = await requireParticipant(ctx);
    const submission = await ctx.db.get(args.id);
    const file = await ctx.db.system.get(args.storageId);
    if (!file) {
      if (args.previewStorageId) await deleteIfOrphan(ctx, args.previewStorageId);
      return { ok: false, error: "Upload not found, try again" };
    }
    if (
      !submission ||
      submission.participantId !== participant._id ||
      isDeleted(submission)
    ) {
      await deleteIfOrphan(ctx, args.storageId);
      if (args.previewStorageId && args.previewStorageId !== args.storageId) {
        await deleteIfOrphan(ctx, args.previewStorageId);
      }
      return { ok: false, error: "Submission not found" };
    }
    if (await storageReferenced(ctx, args.storageId)) {
      if (args.previewStorageId && args.previewStorageId !== args.storageId) {
        await deleteIfOrphan(ctx, args.previewStorageId);
      }
      return { ok: false, error: "That file has already been submitted" };
    }
    let kind: NonNullable<ReturnType<typeof fileKindFromName>>;
    let dimensionsMm: Dimensions;
    let settings: Awaited<ReturnType<typeof readSettings>>;
    try {
      requireReplaceable(submission);
      settings = await requireSubmissionsOpen(ctx);
      const detectedKind = fileKindFromName(args.originalFileName);
      if (!detectedKind) throw new ConvexError("Only STL or 3MF files are accepted");
      kind = detectedKind;
      if (file.size > settings.maxFileBytes) {
        const mb = Math.round(settings.maxFileBytes / (1024 * 1024));
        throw new ConvexError(`Files must be ${mb} MB or smaller`);
      }
      dimensionsMm = cleanDimensions(args.dimensionsMm, settings.maxDimensionsMm);
    } catch (error) {
      await deleteIfOrphan(ctx, args.storageId);
      if (args.previewStorageId && args.previewStorageId !== args.storageId) {
        await deleteIfOrphan(ctx, args.previewStorageId);
      }
      return { ok: false, error: error instanceof Error ? error.message : "Upload failed" };
    }

    const oldVersion = currentVersion(submission);
    const result = await applyFile(
      ctx,
      submission,
      {
        storageId: args.storageId,
        previewStorageId: undefined,
        originalFileName: args.originalFileName.trim().slice(0, 200),
        kind,
        sizeBytes: file.size,
        dimensionsMm,
      },
      "replaced"
    );
    if (!settings.votingOpen && settings.keepVotesOnReplace) {
      const votes = await ctx.db
        .query("votes")
        .withIndex("by_submission", (q) => q.eq("submissionId", submission._id))
        .collect();
      for (const vote of votes) {
        if ((vote.version ?? 1) === oldVersion) {
          await ctx.db.patch(vote._id, { version: result.version });
        }
      }
      const likes = await ctx.db
        .query("likes")
        .withIndex("by_submission", (q) => q.eq("submissionId", submission._id))
        .collect();
      for (const like of likes) {
        if ((like.version ?? 1) === oldVersion) {
          await ctx.db.patch(like._id, { version: result.version });
        }
      }
    }
    if (args.previewStorageId && args.previewStorageId !== args.storageId) {
      await stagePreview(ctx, submission._id, args.previewStorageId, result.version);
    }
    await auditParticipant(
      ctx,
      participant,
      "participant.replace",
      submission._id,
      `v${currentVersion(submission)} → v${result.version}: ${args.originalFileName.trim().slice(0, 200)}`
    );
    if (result.leftQueue) {
      await auditParticipant(ctx, participant, "queue.withdrawn", submission._id, `replaced (v${result.version})`);
    }
    return { ok: true };
  },
});

export const remove = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, { id }) => {
    const { participant, submission } = await requireOwnSubmission(ctx, id);
    if (isDeleted(submission)) throw new ConvexError("Submission not found");
    await requireSubmissionsOpen(ctx);
    if (submission.status === "printing") {
      throw new ConvexError(`${submission.printCode} is printing. Ask staff for changes.`);
    }
    if (submission.status === "done") {
      throw new ConvexError(`${submission.printCode} has been printed. Ask staff for changes.`);
    }
    const now = Date.now();
    const vote = isDesignEntry(submission);
    const print = submission.printRequested;
    const wasQueued = submission.status === "queued";
    await ctx.db.patch(submission._id, {
      deletedAt: now,
      deletedRoles: { vote, print },
      designEntry: false,
      printRequested: false,
      queueOrder: undefined,
      queuedAt: undefined,
      printer: undefined,
      printingAt: undefined,
      status: wasQueued ? "submitted" : submission.status,
      participantNotice: wasQueued
        ? { kind: "withdrawn", version: currentVersion(submission), at: now }
        : submission.participantNotice,
    });
    if (wasQueued) {
      await auditParticipant(ctx, participant, "queue.withdrawn", submission._id, "deleted");
    }
    await auditParticipant(ctx, participant, "participant.delete", submission._id);

    const next = (await ownSubmissions(ctx, participant._id)).find(isActive);
    if (!next) return;
    const takeVote = vote && !isDesignEntry(next) && !next.designRemoved;
    const takePrint = print && !next.printRequested && next.status === "submitted";
    if (!takeVote && !takePrint) return;
    await ctx.db.patch(next._id, {
      designEntry: isDesignEntry(next) || takeVote,
      printRequested: next.printRequested || takePrint,
    });
    await auditParticipant(
      ctx,
      participant,
      "participant.roles",
      next._id,
      `${roleLabel({ vote: isDesignEntry(next) || takeVote, print: next.printRequested || takePrint })} (promoted from ${submission.printCode})`
    );
  },
});

export const setPreview = mutation({
  args: {
    id: v.id("submissions"),
    previewStorageId: v.id("_storage"),
  },
  handler: async (
    ctx,
    { id, previewStorageId }
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const actor = await requireAdmin(ctx);
    const submission = await ctx.db.get(id);
    if (!submission) {
      await deleteIfOrphan(ctx, previewStorageId);
      return { ok: false, error: "Submission not found" };
    }
    await stagePreview(ctx, id, previewStorageId, currentVersion(submission));
    await ctx.db.insert("auditLog", {
      actor,
      action: "submission.preview",
      submissionId: id,
    });
    return { ok: true };
  },
});

export const missingPreviews = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const submissions = await ctx.db.query("submissions").collect();
    return submissions
      .filter((submission) => !isDeleted(submission) && submission.status !== "rejected" && !submission.previewStorageId)
      .map(({ _id, printCode, kind, colour }) => ({ _id, printCode, kind, colour }))
      .sort((a, b) => a.printCode.localeCompare(b.printCode));
  },
});
