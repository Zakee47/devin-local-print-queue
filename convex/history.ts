import { internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./admins";
import { currentVersion, isActive, isDeleted, isDesignEntry } from "./entries";
import { downloadFileName } from "../lib/files";
import { applyFile, previewUrlOf } from "./submissions";
import type { Doc, Id } from "./_generated/dataModel";

type Submission = Doc<"submissions">;

function downloadName(
  submission: Submission,
  participantName: string,
  file: Pick<Doc<"submissionVersions">, "kind">,
  version: number
) {
  return downloadFileName({
    printCode: submission.printCode,
    participantName,
    colour: submission.colour,
    title: submission.title,
    kind: file.kind,
    version,
  });
}

async function restorePlan(ctx: QueryCtx | MutationCtx, submission: Submission) {
  const participant = await ctx.db.get(submission.participantId);
  if (!participant) return { ok: false as const, reason: "Participant not found" };
  const all = await ctx.db
    .query("submissions")
    .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
    .collect();
  const active = all.filter((row) => row._id !== submission._id && isActive(row));
  if (active.length >= 2) {
    return {
      ok: false as const,
      reason: `${participant.displayName} already has 2 active uploads`,
    };
  }
  const deletedRoles = submission.deletedRoles ?? { vote: false, print: false };
  const voteHolder = active.find(isDesignEntry);
  const printHolder = active.find((row) => row.printRequested);
  const vote = deletedRoles.vote && !voteHolder && !submission.designRemoved;
  const print = deletedRoles.print && !printHolder && submission.status !== "rejected";
  if (vote || print) return { ok: true as const, vote, print };

  const blockers: string[] = [];
  if (deletedRoles.vote) {
    if (voteHolder) blockers.push(`Vote is on ${voteHolder.printCode}`);
    else if (submission.designRemoved) blockers.push("Vote was removed from the competition");
  }
  if (deletedRoles.print) {
    if (printHolder) blockers.push(`Print is on ${printHolder.printCode}`);
    else if (submission.status === "rejected") blockers.push("Print was rejected");
  }
  const reason = blockers.length
    ? `No free role for ${submission.printCode}: ${blockers.join("; ")}`
    : `${submission.printCode} had no role when it was deleted`;
  return { ok: false as const, reason };
}

export const forSubmission = query({
  args: { id: v.id("submissions") },
  handler: async (ctx, { id }) => {
    await requireOwner(ctx);
    const submission = await ctx.db.get(id);
    if (!submission) return null;
    const participant = await ctx.db.get(submission.participantId);
    const participantName = participant?.name ?? "unknown";
    const versionRows = await ctx.db
      .query("submissionVersions")
      .withIndex("by_submission", (q) => q.eq("submissionId", id))
      .order("desc")
      .collect();
    const auditRows = await ctx.db
      .query("auditLog")
      .withIndex("by_submission", (q) => q.eq("submissionId", id))
      .order("desc")
      .collect();
    const restoreBlockedReason = isDeleted(submission)
      ? "Restore the submission first"
      : submission.status === "printing"
        ? `${submission.printCode} is printing. Move it back first.`
        : submission.status === "done"
          ? `${submission.printCode} has been printed. Move it back first.`
          : null;
    return {
      printCode: submission.printCode,
      title: submission.title,
      participantUsername: participant?.displayName ?? "Unknown",
      participantEmail: participant?.email ?? "",
      version: currentVersion(submission),
      deletedAt: submission.deletedAt,
      status: submission.status,
      current: {
        version: currentVersion(submission),
        originalFileName: submission.originalFileName,
        kind: submission.kind,
        sizeBytes: submission.sizeBytes,
        dimensionsMm: submission.dimensionsMm,
        previewUrl: await previewUrlOf(ctx, submission),
        downloadName: downloadName(
          submission,
          participantName,
          { kind: submission.kind },
          currentVersion(submission)
        ),
      },
      versions: await Promise.all(
        versionRows.map(async (row) => ({
          _id: row._id,
          version: row.version,
          originalFileName: row.originalFileName,
          kind: row.kind,
          sizeBytes: row.sizeBytes,
          dimensionsMm: row.dimensionsMm,
          archivedAt: row.archivedAt,
          why: row.why,
          previewUrl: row.previewStorageId ? await ctx.storage.getUrl(row.previewStorageId) : null,
          downloadName: downloadName(submission, participantName, row, row.version),
        }))
      ),
      restoreBlockedReason,
      audit: auditRows.map((row) => ({
        _id: row._id,
        at: row._creationTime,
        actor: row.actor,
        action: row.action,
        detail: row.detail ?? "",
      })),
    };
  },
});

export const deletedSubmissions = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const deleted = (await ctx.db.query("submissions").collect())
      .filter(isDeleted)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    return await Promise.all(
      deleted.map(async (submission) => {
        const participant = await ctx.db.get(submission.participantId);
        return {
          _id: submission._id,
          printCode: submission.printCode,
          title: submission.title,
          participantUsername: participant?.displayName ?? "Unknown",
          participantEmail: participant?.email ?? "",
          version: currentVersion(submission),
          deletedAt: submission.deletedAt!,
          deletedRoles: submission.deletedRoles ?? { vote: isDesignEntry(submission), print: submission.printRequested },
          previewUrl: await previewUrlOf(ctx, submission),
          restore: await restorePlan(ctx, submission),
        };
      })
    );
  },
});

export const restoreVersion = mutation({
  args: { versionId: v.id("submissionVersions") },
  handler: async (ctx, { versionId }) => {
    const actor = await requireOwner(ctx);
    const version = await ctx.db.get(versionId);
    if (!version) throw new Error("Version not found");
    const submission = await ctx.db.get(version.submissionId);
    if (!submission) throw new Error("Submission not found");
    if (isDeleted(submission)) throw new Error("Restore the submission first");
    if (submission.status === "printing") {
      throw new Error(`${submission.printCode} is printing. Move it back first.`);
    }
    if (submission.status === "done") {
      throw new Error(`${submission.printCode} has been printed. Move it back first.`);
    }
    if (!(await ctx.db.system.get("_storage", version.storageId))) {
      throw new Error("That version's file is no longer available");
    }
    const result = await applyFile(
      ctx,
      submission,
      {
        storageId: version.storageId,
        previewStorageId: version.previewStorageId,
        originalFileName: version.originalFileName,
        kind: version.kind,
        sizeBytes: version.sizeBytes,
        dimensionsMm: version.dimensionsMm,
      },
      "restored"
    );
    await ctx.db.insert("auditLog", {
      actor,
      action: "history.restoreVersion",
      submissionId: submission._id,
      detail: `v${version.version} restored as v${result.version}`,
    });
  },
});

export const restoreSubmission = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, { id }) => {
    const actor = await requireOwner(ctx);
    const submission = await ctx.db.get(id);
    if (!submission || !isDeleted(submission)) throw new Error("Submission is not deleted");
    const participant = await ctx.db.get(submission.participantId);
    if (!participant) throw new Error("Participant not found");
    const plan = await restorePlan(ctx, submission);
    if (!plan.ok) throw new Error(plan.reason);
    await ctx.db.patch(id, {
      deletedAt: undefined,
      deletedRoles: undefined,
      designEntry: plan.vote,
      printRequested: plan.print,
    });
    const roles = [plan.vote ? "Vote" : "", plan.print ? "Print" : ""].filter(Boolean);
    await ctx.db.insert("auditLog", {
      actor,
      action: "history.restoreSubmission",
      submissionId: id,
      detail: roles.length ? roles.join("+") : "No roles",
    });
  },
});

export const versionDownloadInfo = internalQuery({
  args: { versionId: v.string() },
  handler: async (ctx, { versionId }) => {
    await requireOwner(ctx);
    const id = ctx.db.normalizeId("submissionVersions", versionId) as Id<"submissionVersions"> | null;
    const version = id ? await ctx.db.get(id) : null;
    if (!version) return null;
    const submission = await ctx.db.get(version.submissionId);
    if (!submission) return null;
    const participant = await ctx.db.get(submission.participantId);
    return {
      storageId: version.storageId,
      fileName: downloadName(submission, participant?.name ?? "unknown", version, version.version),
    };
  },
});
