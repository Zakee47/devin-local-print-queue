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

export async function previewUrlOf(ctx: QueryCtx, submission: Doc<"submissions">): Promise<string | null> {
  return submission.previewStorageId ? await ctx.storage.getUrl(submission.previewStorageId) : null;
}

async function deleteIfOrphan(ctx: MutationCtx, storageId: Id<"_storage">) {
  const referenced = await ctx.db
    .query("submissions")
    .filter((q) =>
      q.or(
        q.eq(q.field("storageId"), storageId),
        q.eq(q.field("previewStorageId"), storageId)
      )
    )
    .first();
  if (!referenced && (await ctx.db.system.get("_storage", storageId))) {
    await ctx.storage.delete(storageId);
  }
}

async function stagePreview(
  ctx: MutationCtx,
  submissionId: Id<"submissions">,
  previewStorageId: Id<"_storage">
) {
  const referenced = await ctx.db
    .query("submissions")
    .filter((q) =>
      q.or(
        q.eq(q.field("storageId"), previewStorageId),
        q.eq(q.field("previewStorageId"), previewStorageId)
      )
    )
    .first();
  if (referenced) return;
  const meta = await ctx.db.system.get("_storage", previewStorageId);
  if (!meta) return;
  if (meta.size > MAX_PREVIEW_BYTES) {
    await ctx.storage.delete(previewStorageId);
    return;
  }
  await ctx.scheduler.runAfter(0, internal.submissions.verifyPreview, {
    submissionId,
    previewStorageId,
  });
}

export const verifyPreview = internalAction({
  args: {
    submissionId: v.id("submissions"),
    previewStorageId: v.id("_storage"),
  },
  handler: async (ctx, { submissionId, previewStorageId }) => {
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
    });
  },
});

export const attachPreview = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    previewStorageId: v.id("_storage"),
  },
  handler: async (ctx, { submissionId, previewStorageId }) => {
    const submission = await ctx.db.get(submissionId);
    if (!submission) {
      if (await ctx.db.system.get("_storage", previewStorageId)) {
        await ctx.storage.delete(previewStorageId);
      }
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
    previewStorageId: v.optional(v.id("_storage")),
    title: v.string(),
    notes: v.optional(v.string()),
    colour: v.optional(v.string()),
    originalFileName: v.string(),
    dimensionsMm: v.object({ x: v.number(), y: v.number(), z: v.number() }),
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
    const alreadyUsed = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .first();
    if (alreadyUsed) {
      if (args.previewStorageId && args.previewStorageId !== args.storageId) {
        await deleteIfOrphan(ctx, args.previewStorageId);
      }
      return { ok: false, error: "That file has already been submitted" };
    }

    try {
      const { settings, active } = await assertCanUpload(ctx, participant._id);
      const kind = fileKindFromName(args.originalFileName);
      if (!kind) throw new ConvexError("Only STL or 3MF files are accepted");
      if (file.size > settings.maxFileBytes) {
        const mb = Math.round(settings.maxFileBytes / (1024 * 1024));
        throw new ConvexError(`Files must be ${mb} MB or smaller`);
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
      if (args.previewStorageId && args.previewStorageId !== args.storageId) {
        await stagePreview(ctx, id, args.previewStorageId);
      }
      return { ok: true, id };
    } catch (e) {
      await ctx.storage.delete(args.storageId);
      if (args.previewStorageId && args.previewStorageId !== args.storageId) {
        await deleteIfOrphan(ctx, args.previewStorageId);
      }
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
          previewUrl: await previewUrlOf(ctx, s),
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
    if (choiceLocked(all)) throw new ConvexError("Your entry is locked in");
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
    previewStorageId: v.optional(v.id("_storage")),
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
    if (args.previewStorageId) await stagePreview(ctx, submission._id, args.previewStorageId);
  },
});

export const remove = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, { id }) => {
    const { participant, submission } = await requireOwnSubmission(ctx, id);
    requireEditable(submission);
    await ctx.db.delete(submission._id);
    await ctx.storage.delete(submission.storageId);
    if (submission.previewStorageId && submission.previewStorageId !== submission.storageId) {
      await deleteIfOrphan(ctx, submission.previewStorageId);
    }
    if (submission.printRequested) {
      const next = (await ownSubmissions(ctx, participant._id)).find(isActive);
      if (next) await ctx.db.patch(next._id, { printRequested: true });
    }
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
    await stagePreview(ctx, id, previewStorageId);
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
      .filter((submission) => submission.status !== "rejected" && !submission.previewStorageId)
      .map(({ _id, printCode, kind, colour }) => ({ _id, printCode, kind, colour }))
      .sort((a, b) => a.printCode.localeCompare(b.printCode));
  },
});
