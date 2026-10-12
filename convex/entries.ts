import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

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

// A vote-only design staff approved for voting: shown as Done, never printed.
export function isApprovedForVoting(s: Doc<"submissions">): boolean {
  return s.status === "submitted" && !s.printRequested && s.votingApprovedAt !== undefined;
}

// A row that (re)gains Print is a fresh print request awaiting review.
export function gainPrintPatch(s: Doc<"submissions">) {
  return {
    votingApprovedAt: undefined,
    ...(s.participantNotice?.kind === "withdrawn" ? { participantNotice: undefined } : {}),
  };
}

export const PRINT_AFTER_VOTING_APPROVAL = "queue.printAfterVotingApproval";

// "KC-014 · priya · Sky Blue" for audit rows about a design.
export async function designAuditDetail(ctx: QueryCtx, s: Doc<"submissions">): Promise<string> {
  const participant = await ctx.db.get(s.participantId);
  return [s.printCode, participant?.displayName, s.colour].filter(Boolean).join(" · ");
}

// Call with the row as it was before gaining Print: logs when that drops a
// staff approval for voting.
export async function logPrintAfterVotingApproval(
  ctx: MutationCtx,
  actor: string,
  before: Doc<"submissions">
) {
  if (before.printRequested || before.votingApprovedAt === undefined) return;
  await ctx.db.insert("auditLog", {
    actor,
    action: PRINT_AFTER_VOTING_APPROVAL,
    submissionId: before._id,
    detail: await designAuditDetail(ctx, before),
  });
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
