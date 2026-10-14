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

export type SearchableRow = QueueViewRow & {
  printCode: string;
  title: string;
  participantUsername: string;
  participantName: string;
  downloadName: string;
  notes?: string;
  rejectionReason?: string;
};

export function isWithdrawnRow(row: QueueViewRow) {
  return row.participantNotice?.kind === "withdrawn" && !row.printRequested;
}

export function bucketOf(row: QueueViewRow): QueueBucket {
  if (row.deletedAt !== undefined) return "deleted";
  if (row.status === "submitted") {
    if (isWithdrawnRow(row)) return "withdrawn";
    if (!row.printRequested && row.votingApprovedAt !== undefined) return "done";
    return "review";
  }
  return row.status;
}

export type DoneGroup = "printed" | "votingOnly";

export const DONE_GROUPS: { value: DoneGroup; label: string }[] = [
  { value: "printed", label: "Printed" },
  { value: "votingOnly", label: "Approved for voting only" },
];

// Splits Done rows: status "done" was physically printed; the rest are
// vote-only designs approved for voting.
export function splitDone<T extends QueueViewRow>(rows: T[]): Record<DoneGroup, T[]> {
  return {
    printed: rows.filter((row) => row.status === "done"),
    votingOnly: rows.filter((row) => row.status !== "done"),
  };
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

export function normalizeSearch(s: string) {
  return s.toLowerCase().replace(/[\s_\-·.]+/g, "");
}

export function searchFields(row: SearchableRow) {
  const printCodeDigits = row.printCode.match(/\d+$/)?.[0].replace(/^0+/, "");
  return [
    row.printCode,
    printCodeDigits,
    row.title,
    row.participantUsername,
    row.participantName,
    row.downloadName,
    row.colour ?? "Any colour",
    row.printer ?? "Not assigned",
    row.notes,
    row.rejectionReason,
  ].filter((field): field is string => typeof field === "string" && field.trim().length > 0);
}

export function matchesSearch(row: SearchableRow, query: string) {
  const normalizedQuery = normalizeSearch(query);
  return !normalizedQuery || searchFields(row).some((field) => normalizeSearch(field).includes(normalizedQuery));
}

export function highlightRanges(text: string, query: string): [number, number][] {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return [];

  let flat = "";
  const starts: number[] = [];
  const ends: number[] = [];
  for (let index = 0; index < text.length;) {
    const character = String.fromCodePoint(text.codePointAt(index)!);
    const end = index + character.length;
    if (!/[\s_\-·.]/u.test(character)) {
      const normalizedCharacter = character.toLowerCase().replace(/[\s_\-·.]+/g, "");
      for (let offset = 0; offset < normalizedCharacter.length; offset += 1) {
        starts.push(index);
        ends.push(end);
      }
      flat += normalizedCharacter;
    }
    index = end;
  }

  const ranges: [number, number][] = [];
  let from = 0;
  let match = flat.indexOf(normalizedQuery, from);
  while (match !== -1) {
    ranges.push([starts[match], ends[match + normalizedQuery.length - 1]]);
    from = match + normalizedQuery.length;
    match = flat.indexOf(normalizedQuery, from);
  }
  return ranges;
}

export type SearchSuggestion = {
  dimension: FilterDimension;
  value: string;
  count: number;
};

export function searchSuggestions(
  rows: QueueViewRow[],
  query: string,
  pills: FilterPill[],
  colours: string[],
  printers: string[]
): SearchSuggestion[] {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return [];

  const candidates = [
    ...[ANY_COLOUR, ...colours].map((value) => ({
      dimension: "colour" as const,
      value,
      label: value === ANY_COLOUR ? "Any colour" : value,
    })),
    ...[NOT_ASSIGNED, ...printers].map((value) => ({
      dimension: "printer" as const,
      value,
      label: value === NOT_ASSIGNED ? "Not assigned" : value,
    })),
  ];

  return candidates
    .filter(({ dimension, value, label }) =>
      normalizeSearch(label).includes(normalizedQuery) &&
      !pills.some((pill) =>
        pill.dimension === dimension &&
        pill.values.some((selected) => selected.toLowerCase() === value.toLowerCase())
      )
    )
    .slice(0, 6)
    .map(({ dimension, value }) => ({
      dimension,
      value,
      count: rows.filter((row) => filterMatches(row, { id: 0, dimension, values: [value] })).length,
    }));
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

export function partitionPrinters(
  inService: { name: string }[],
  matchingNames: string[],
  colour?: string
): { matching: string[]; other: string[] } {
  if (!colour) return { matching: [], other: inService.map((printer) => printer.name) };
  const matching = new Set(matchingNames.map((name) => name.trim().toLowerCase()));
  return {
    matching: inService.filter(({ name }) => matching.has(name.trim().toLowerCase())).map(({ name }) => name),
    other: inService.filter(({ name }) => !matching.has(name.trim().toLowerCase())).map(({ name }) => name),
  };
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
