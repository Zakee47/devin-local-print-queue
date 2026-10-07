import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { requireParticipant, viewerParticipant } from "./participants";
import { isEntry, requireVotingOpen } from "./votes";
import { countsFor, currentVersion } from "./entries";

export type ReactionCounts = { likes: number; skips: number };

// Like/skip totals per submission from participants who still have an account.
export async function reactionCounts(ctx: QueryCtx | MutationCtx) {
  const counts = new Map<Id<"submissions">, ReactionCounts>();
  const exists = new Map<Id<"participants">, boolean>();
  const submissions = new Map<Id<"submissions">, Doc<"submissions"> | null>();
  for (const row of await ctx.db.query("likes").collect()) {
    if (!exists.has(row.participantId)) exists.set(row.participantId, !!(await ctx.db.get(row.participantId)));
    if (!exists.get(row.participantId)) continue;
    if (!submissions.has(row.submissionId)) {
      submissions.set(row.submissionId, await ctx.db.get(row.submissionId));
    }
    const submission = submissions.get(row.submissionId);
    if (!submission || !countsFor(row, submission)) continue;
    const c = counts.get(row.submissionId) ?? { likes: 0, skips: 0 };
    if (row.reaction === "like") c.likes++;
    else c.skips++;
    counts.set(row.submissionId, c);
  }
  return counts;
}

async function existingReaction(
  ctx: MutationCtx,
  participantId: Id<"participants">,
  submissionId: Id<"submissions">
) {
  return await ctx.db
    .query("likes")
    .withIndex("by_participant_submission", (q) =>
      q.eq("participantId", participantId).eq("submissionId", submissionId)
    )
    .unique();
}

// The viewer's reactions, or null if they aren't a registered participant.
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const participant = await viewerParticipant(ctx);
    if (!participant) return null;
    const rows = await ctx.db
      .query("likes")
      .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
      .collect();
    const current = [];
    for (const row of rows) {
      const submission = await ctx.db.get(row.submissionId);
      if (submission && countsFor(row, submission)) {
        current.push({ submissionId: row.submissionId, reaction: row.reaction });
      }
    }
    return current;
  },
});

export const react = mutation({
  args: {
    submissionId: v.id("submissions"),
    reaction: v.union(v.literal("like"), v.literal("skip")),
  },
  handler: async (ctx, { submissionId, reaction }) => {
    const participant = await requireParticipant(ctx);
    await requireVotingOpen(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || !(await isEntry(ctx, submission))) {
      throw new ConvexError("That design isn't in the running any more");
    }
    if (submission.participantId === participant._id) {
      throw new ConvexError("You can't like your own entry");
    }
    const existing = await existingReaction(ctx, participant._id, submissionId);
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { reaction, updatedAt, version: currentVersion(submission) });
      return existing._id;
    }
    return await ctx.db.insert("likes", {
      participantId: participant._id,
      submissionId,
      reaction,
      updatedAt,
      version: currentVersion(submission),
    });
  },
});

// Undo: forget the viewer's reaction so the card counts as not seen.
export const clearReaction = mutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const participant = await requireParticipant(ctx);
    await requireVotingOpen(ctx);
    const existing = await existingReaction(ctx, participant._id, submissionId);
    if (existing) await ctx.db.delete(existing._id);
  },
});
