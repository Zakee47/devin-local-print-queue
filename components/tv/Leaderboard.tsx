"use client";

import { Heart } from "lucide-react";
import type { TvLeader } from "@/convex/tv";
import Swatch from "./Swatch";

// Runners-up under the winner: rank 2 onwards.
export default function Leaderboard({ leaders, top }: { leaders: TvLeader[]; top: number }) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card px-8 py-7">
      <h2 className="font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">Runners-up</h2>
      {leaders.length === 0 ? (
        <p className="mt-6 text-2xl text-muted-foreground">No runners-up yet.</p>
      ) : (
        <ol className="mt-4 flex min-h-0 flex-col gap-2">
          {leaders.map((l, i) => (
            <li
              key={l.printCode}
              style={{ animationDelay: `${i * 80}ms` }}
              className="relative flex h-[68px] shrink-0 items-center gap-5 overflow-hidden rounded-xl border border-border bg-background px-6 animate-in fade-in slide-in-from-right-6 fill-mode-both duration-500"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-white/[0.04] transition-[width] duration-700"
                style={{ width: `${(l.votes / Math.max(top, 1)) * 100}%` }}
              />
              <span className="relative w-12 font-mono text-3xl font-semibold text-muted-foreground tabular-nums">
                {l.rank}
              </span>
              <Swatch colour={l.colour} className="size-5" />
              <span className="relative flex min-w-0 flex-1 flex-col">
                <span className="truncate text-2xl leading-tight font-semibold">{l.title}</span>
                <span className="truncate text-xl leading-tight text-muted-foreground">{l.displayName}</span>
              </span>
              <span className="relative flex items-center gap-1.5 font-mono text-lg text-muted-foreground tabular-nums">
                <Heart className="size-4 text-brand" aria-hidden />
                {l.likes}
              </span>
              <span className="relative w-36 text-right font-mono text-3xl font-semibold tabular-nums">
                {l.votes}
                <span className="ml-2 text-base font-normal text-muted-foreground">vote{l.votes === 1 ? "" : "s"}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
