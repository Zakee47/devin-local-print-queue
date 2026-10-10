import type { Id } from "@/convex/_generated/dataModel";

export const ANY_COLOUR = "__any_colour__";
export const NOT_ASSIGNED = "__not_assigned__";
export type FilterDimension = "colour" | "printer";
export type FilterPill = { id: number; dimension: FilterDimension; values: string[] };
export type QueueBucket = "review" | "queued" | "printing" | "done" | "rejected" | "withdrawn" | "deleted";

export type QueueViewRow = {
  _id: Id<"submissions">;
  _creationTime: number;
  status: "submitted" | "queued" | "printing" | "done" | "rejected";
  printRequested: boolean;
  votingApprovedAt?: number;
  deletedAt?: number;
  participantNotice?: { kind: string; at: number };
  colour?: string;
  printer?: string;
  queueOrder?: number;
  participantPrint?: { printCode: string; status: string } | null;
  printingAt?: number;
  doneAt?: number;
  rejectedAt?: number;
};

export function bucketOf(row: QueueViewRow): QueueBucket {
  if (row.deletedAt !== undefined) return "deleted";
  if (row.status === "submitted") {
    if (row.participantNotice?.kind === "withdrawn") return "withdrawn";
    if (!row.printRequested && row.votingApprovedAt !== undefined) return "done";
    return "review";
  }
  return row.status;
}

export function filterMatches(row: QueueViewRow, pill: FilterPill) {
  if (!pill.values.length) return true;
  if (pill.dimension === "colour") {
    return pill.values.some((value) => value === ANY_COLOUR ? !row.colour : row.colour?.toLowerCase() === value.toLowerCase());
  }
  return pill.values.some((value) => value === NOT_ASSIGNED ? !row.printer : row.printer?.toLowerCase() === value.toLowerCase());
}

export function applyFilters<T extends QueueViewRow>(rows: T[], pills: FilterPill[]) {
  return rows.filter((row) => pills.every((pill) => filterMatches(row, pill)));
}

export function optionCounts<T extends QueueViewRow>(
  rows: T[],
  pills: FilterPill[],
  pillIndex: number,
  dimension: FilterDimension,
  options: string[]
) {
  const earlier = applyFilters(rows, pills.slice(0, pillIndex));
  return Object.fromEntries(options.map((option) => [
    option,
    earlier.filter((row) =>
      dimension === "colour"
        ? option === ANY_COLOUR ? !row.colour : row.colour?.toLowerCase() === option.toLowerCase()
        : option === NOT_ASSIGNED ? !row.printer : row.printer?.toLowerCase() === option.toLowerCase()
    ).length,
  ]));
}

export function sortBuckets<T extends QueueViewRow>(rows: T[]) {
  const buckets: Record<QueueBucket, T[]> = {
    review: [], queued: [], printing: [], done: [], rejected: [], withdrawn: [], deleted: [],
  };
  for (const row of rows) buckets[bucketOf(row)].push(row);
  buckets.review.sort((a, b) => Number(Boolean(a.participantPrint)) - Number(Boolean(b.participantPrint)) || a._creationTime - b._creationTime);
  buckets.queued.sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0));
  buckets.printing.sort((a, b) => (a.printingAt ?? 0) - (b.printingAt ?? 0));
  buckets.done.sort((a, b) => (b.doneAt ?? b.votingApprovedAt ?? 0) - (a.doneAt ?? a.votingApprovedAt ?? 0));
  buckets.rejected.sort((a, b) => (b.rejectedAt ?? 0) - (a.rejectedAt ?? 0));
  buckets.withdrawn.sort((a, b) => (b.participantNotice?.at ?? 0) - (a.participantNotice?.at ?? 0));
  return buckets;
}

export function beforeIdAfterDrop(
  fullOrder: Id<"submissions">[],
  visibleOrder: Id<"submissions">[],
  activeId: Id<"submissions">,
  overId: Id<"submissions">
) {
  const from = visibleOrder.indexOf(activeId);
  const to = visibleOrder.indexOf(overId);
  if (from < 0 || to < 0) return undefined;
  const after = [...visibleOrder];
  after.splice(to, 0, ...after.splice(from, 1));
  const movedIndex = after.indexOf(activeId);
  if (after[movedIndex + 1]) return after[movedIndex + 1];
  const fullWithoutActive = fullOrder.filter((id) => id !== activeId);
  const lastVisible = after.filter((id) => id !== activeId).at(-1);
  if (!lastVisible) return undefined;
  const lastVisibleIndex = fullWithoutActive.indexOf(lastVisible);
  return fullWithoutActive[lastVisibleIndex + 1];
}
