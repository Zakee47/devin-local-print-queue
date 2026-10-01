import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

export async function entryFor(
  ctx: QueryCtx,
  participantId: Id<"participants">
): Promise<Doc<"submissions"> | null> {
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_participant", (q) => q.eq("participantId", participantId))
    .collect();
  return submissions.find((submission) => submission.printRequested && submission.status !== "rejected") ?? null;
}

export async function listEntries(ctx: QueryCtx): Promise<Doc<"submissions">[]> {
  const submissions = await ctx.db.query("submissions").collect();
  return submissions
    .filter((submission) => submission.printRequested && submission.status !== "rejected")
    .sort((a, b) => a.printCode.localeCompare(b.printCode));
}
