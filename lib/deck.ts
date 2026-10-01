import type { Reaction } from "./event";

export type DeckFilter = "unseen" | "liked" | "skipped" | "all";

export const DECK_FILTERS: { value: DeckFilter; label: string }[] = [
  { value: "unseen", label: "Not seen yet" },
  { value: "liked", label: "Liked" },
  { value: "skipped", label: "Skipped" },
  { value: "all", label: "All" },
];

export function matchesFilter(reaction: Reaction | undefined, filter: DeckFilter) {
  if (filter === "all") return true;
  if (filter === "unseen") return reaction === undefined;
  if (filter === "liked") return reaction === "like";
  return reaction === "skip";
}

export function filterCounts(reactions: (Reaction | undefined)[]): Record<DeckFilter, number> {
  const counts: Record<DeckFilter, number> = { unseen: 0, liked: 0, skipped: 0, all: 0 };
  for (const r of reactions) {
    for (const { value } of DECK_FILTERS) if (matchesFilter(r, value)) counts[value]++;
  }
  return counts;
}
