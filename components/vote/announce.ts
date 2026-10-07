export type VoteEvent =
  | { kind: "cast"; title: string; votesLeft: number }
  | { kind: "retract"; title: string; votesLeft: number }
  | { kind: "swap"; from: string; to: string };

export function voteAnnouncement(e: VoteEvent): string {
  if (e.kind === "swap") return `Vote moved from ${e.from} to ${e.to}.`;
  if (e.votesLeft === 0) {
    return e.kind === "cast"
      ? `Vote cast for ${e.title}. No votes left.`
      : `Vote removed from ${e.title}. No votes left.`;
  }
  const votes = `${e.votesLeft} ${e.votesLeft === 1 ? "vote" : "votes"} left.`;
  return e.kind === "cast"
    ? `Vote cast for ${e.title}. ${votes}`
    : `Vote removed from ${e.title}. ${votes}`;
}
