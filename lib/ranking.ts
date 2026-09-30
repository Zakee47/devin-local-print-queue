// Final ranking: votes first, likes break ties, then print code for a stable
// order. Entries tied on both votes and likes share a rank (1, 2, 2, 4).
export type Rankable = { votes: number; likes: number; printCode: string };

export function compareRanking(a: Rankable, b: Rankable) {
  return b.votes - a.votes || b.likes - a.likes || a.printCode.localeCompare(b.printCode);
}

export function rankRows<T extends Rankable>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort(compareRanking);
  const ranked: (T & { rank: number })[] = [];
  for (const [i, row] of sorted.entries()) {
    const prev = ranked[i - 1];
    const tied = prev && prev.votes === row.votes && prev.likes === row.likes;
    ranked.push({ ...row, rank: tied ? prev.rank : i + 1 });
  }
  return ranked;
}
