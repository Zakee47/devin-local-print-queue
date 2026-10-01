"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { TvBoard as Board } from "@/convex/tv";
import Leaderboard from "./Leaderboard";
import LiveLeaderboard from "@/components/leaderboard/LiveLeaderboard";
import Notices from "./Notices";
import NowPrinting from "./NowPrinting";
import QrRail from "./QrRail";
import TvHeader from "./TvHeader";
import TvStage from "./TvStage";
import UpNext from "./UpNext";
import Winner from "./Winner";
import { useArrivals, useNow } from "./hooks";

const EMPTY: Extract<Board, { mode: "queue" }> = {
  mode: "queue",
  counts: { submitted: 0, queued: 0, printing: 0, done: 0 },
  notices: { announcement: null, submissionsOpen: true, submissionsDeadline: null },
  votingOpen: false,
  votingNotOpenYet: true,
  printing: [],
  upNext: [],
  moreQueued: 0,
  recentDone: [],
  leaderboard: [],
  totalVotes: 0,
  totalLikes: 0,
};

export default function TvBoard() {
  const board = useQuery(api.tv.board) ?? EMPTY;
  return (
    <TvStage>
      <div className="grid h-full grid-cols-[1fr_340px]">
        <div className="grid min-h-0 min-w-0 grid-rows-[112px_auto_1fr]">
          <TvHeader counts={board.counts} />
          <Notices notices={board.notices} />
          {board.mode === "results" ? <ResultsView board={board} /> : <QueueView board={board} />}
        </div>
        <QrRail />
      </div>
    </TvStage>
  );
}

function ResultsView({ board }: { board: Extract<Board, { mode: "results" }> }) {
  return (
    <div className="row-start-3 grid min-h-0 grid-cols-[1fr_620px] gap-6 p-8 pt-6">
      <Winner winner={board.winner} totalVotes={board.totalVotes} />
      <Leaderboard leaders={board.runnersUp} top={board.winner?.votes ?? 1} />
    </div>
  );
}

function QueueView({ board }: { board: Extract<Board, { mode: "queue" }> }) {
  const now = useNow();
  const freshPrinting = useArrivals(board.printing.map((i) => i.printCode));
  return (
    <div className="row-start-3 grid min-h-0 grid-cols-[1fr_540px] gap-6 p-8 pt-6">
      <LiveLeaderboard
        variant="tv"
        rows={board.leaderboard}
        totalVotes={board.totalVotes}
        totalLikes={board.totalLikes}
        votingOpen={board.votingOpen}
        votingNotOpenYet={board.votingNotOpenYet}
      />
      <div className="flex min-h-0 flex-col gap-5">
        <NowPrinting items={board.printing} now={now} fresh={freshPrinting} compact />
        <UpNext
          items={board.upNext.slice(0, 3)}
          more={Math.max(0, board.upNext.length - 3 + board.moreQueued)}
          compact
        />
      </div>
    </div>
  );
}
