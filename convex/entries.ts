import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

type DesignFields = Pick<Doc<"submissions">, "designEntry" | "printRequested">;

export function isDeleted(s: Pick<Doc<"submissions">, "deletedAt">): boolean {
  return s.deletedAt !== undefined;
}

export function isActive(s: Doc<"submissions">): boolean {
  return !isDeleted(s) && (s.status !== "rejected" || isDesignEntry(s));
}

export function currentVersion(s: Pick<Doc<"submissions">, "version">): number {
  return s.version ?? 1;
}

export function countsFor(
  row: { version?: number },
  submission: Pick<Doc<"submissions">, "version">
): boolean {
  return (row.version ?? 1) === currentVersion(submission);
}

export function isDesignEntry(s: DesignFields): boolean {
  return s.designEntry ?? s.printRequested;
}

// Patch fields that move printRequested without dragging a legacy row's
// design entry along with it.
export function printRequestPatch(s: DesignFields, printRequested: boolean) {
  return { printRequested, designEntry: isDesignEntry(s) };
}

export function inCompetition(s: Doc<"submissions">): boolean {
  return !isDeleted(s) && isDesignEntry(s) && !s.designRemoved;
}

export async function entryFor(
  ctx: QueryCtx,
  participantId: Id<"participants">
): Promise<Doc<"submissions"> | null> {
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_participant", (q) => q.eq("participantId", participantId))
    .collect();
  return submissions.find(inCompetition) ?? null;
}

export async function listEntries(ctx: QueryCtx): Promise<Doc<"submissions">[]> {
  const submissions = await ctx.db.query("submissions").collect();
  return submissions.filter(inCompetition).sort((a, b) => a.printCode.localeCompare(b.printCode));
}
