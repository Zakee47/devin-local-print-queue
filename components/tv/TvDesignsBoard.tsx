"use client";

import type { TvDesigns } from "@/convex/tv";
import LiveLeaderboard from "@/components/leaderboard/LiveLeaderboard";
import Collage from "./Collage";

export const EMPTY_DESIGNS: TvDesigns = {
  defaultView: "main",
  counts: { submitted: 0, queued: 0, printing: 0, done: 0 },
  notices: { announcement: null, submissionsOpen: true, submissionsDeadline: null },
  votingOpen: false,
  votingNotOpenYet: true,
  leaderboard: [],
  totalVotes: 0,
  totalLikes: 0,
  collage: [],
};

export default function TvDesignsBoard({ board }: { board: TvDesigns }) {
  return (
    <div className="row-start-3 grid min-h-0 grid-cols-[720px_minmax(0,1fr)] gap-6 p-8 pt-6">
      <LiveLeaderboard
        variant="tv"
        rows={board.leaderboard}
        totalVotes={board.totalVotes}
        totalLikes={board.totalLikes}
        votingOpen={board.votingOpen}
        votingNotOpenYet={board.votingNotOpenYet}
      />
      <Collage items={board.collage} />
    </div>
  );
}
