"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { TvBoard as Board } from "@/convex/tv";
import FreshOff from "./FreshOff";
import Leaderboard from "./Leaderboard";
import MostLiked from "./MostLiked";
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
  printing: [],
  upNext: [],
  moreQueued: 0,
  recentDone: [],
  mostLiked: [],
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
    <div className="grid min-h-0 grid-cols-[1fr_620px] gap-6 p-8 pt-6">
      <Winner winner={board.winner} totalVotes={board.totalVotes} />
      <Leaderboard leaders={board.runnersUp} top={board.winner?.votes ?? 1} />
    </div>
  );
}

function QueueView({ board }: { board: Extract<Board, { mode: "queue" }> }) {
  const now = useNow();
  const freshPrinting = useArrivals(board.printing.map((i) => i.printCode));
  const freshDone = useArrivals(board.recentDone.map((i) => i.printCode));
  return (
    <div className="grid min-h-0 grid-cols-[1fr_720px] gap-6 p-8 pt-6">
      <NowPrinting items={board.printing} now={now} fresh={freshPrinting} />
      <div className="flex min-h-0 flex-col gap-5">
        <UpNext items={board.upNext} more={board.moreQueued} />
        <FreshOff items={board.recentDone} now={now} fresh={freshDone} />
        <MostLiked items={board.mostLiked} />
      </div>
    </div>
  );
}
