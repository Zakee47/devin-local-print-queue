"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { TvBoard as Board } from "@/convex/tv";
import Counters from "./Counters";
import FreshOff from "./FreshOff";
import Leaderboard from "./Leaderboard";
import NowPrinting from "./NowPrinting";
import TvFooter from "./TvFooter";
import TvStage from "./TvStage";
import UpNext from "./UpNext";
import { useArrivals, useNow } from "./hooks";

const EMPTY: Extract<Board, { mode: "queue" }> = {
  mode: "queue",
  counts: { submitted: 0, queued: 0, printing: 0, done: 0 },
  printing: [],
  upNext: [],
  moreQueued: 0,
  recentDone: [],
};

export default function TvBoard() {
  const board = useQuery(api.tv.board);
  return (
    <TvStage>
      <div className="grid h-full grid-rows-[1fr_150px]">
        {board?.mode === "results" ? (
          <div className="grid min-h-0 grid-cols-[1fr_400px] gap-6 p-8 pb-6">
            <Leaderboard leaders={board.leaderboard} totalVotes={board.totalVotes} />
            <div className="flex flex-col gap-6">
              {(
                [
                  ["Entries", board.counts.submitted],
                  ["Printed", board.counts.done],
                  ["Votes", board.totalVotes],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex flex-1 flex-col justify-center rounded-2xl border border-border bg-card px-9">
                  <p className="font-mono text-lg tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
                  <p className="font-heading text-8xl font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <QueueView board={board ?? EMPTY} />
        )}
        <TvFooter
          message={board?.mode === "results" ? "See every design at" : "Scan to submit your keychain"}
        />
      </div>
    </TvStage>
  );
}

function QueueView({ board }: { board: Extract<Board, { mode: "queue" }> }) {
  const now = useNow();
  const freshPrinting = useArrivals(board.printing.map((i) => i.printCode));
  const freshDone = useArrivals(board.recentDone.map((i) => i.printCode));
  return (
    <div className="grid min-h-0 grid-cols-[1fr_860px] gap-6 p-8 pb-6">
      <NowPrinting items={board.printing} now={now} fresh={freshPrinting} />
      <div className="flex min-h-0 flex-col gap-6">
        <Counters counts={board.counts} />
        <UpNext items={board.upNext} more={board.moreQueued} />
        <FreshOff items={board.recentDone} now={now} fresh={freshDone} />
      </div>
    </div>
  );
}
