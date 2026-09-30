"use client";

import { Trophy } from "lucide-react";
import type { TvLeader } from "@/convex/tv";
import { cn } from "@/lib/utils";
import Swatch from "./Swatch";

export default function Leaderboard({ leaders, totalVotes }: { leaders: TvLeader[]; totalVotes: number }) {
  const top = leaders[0]?.votes ?? 1;
  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card px-12 py-10">
      <header className="flex items-end justify-between">
        <div>
          <p className="flex items-center gap-3 font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">
            <Trophy className="size-5 text-brand" />
            Voting results
          </p>
          <h1 className="mt-3 font-heading text-7xl font-semibold tracking-[-0.03em]">Top keychains</h1>
        </div>
        <p className="font-mono text-2xl text-muted-foreground tabular-nums">
          {totalVotes} vote{totalVotes === 1 ? "" : "s"} cast
        </p>
      </header>
      {leaders.length === 0 ? (
        <p className="m-auto text-4xl text-muted-foreground">No votes yet.</p>
      ) : (
        <ol className="mt-8 flex flex-col gap-3">
          {leaders.map((l, i) => (
            <li
              key={l.printCode}
              style={{ animationDelay: `${i * 80}ms` }}
              className={cn(
                "relative flex items-center gap-8 overflow-hidden rounded-xl border border-border px-8 animate-in fade-in slide-in-from-left-6 fill-mode-both duration-500",
                l.rank === 1 ? "h-[108px] border-brand/60 bg-brand/10" : "h-[62px] bg-background"
              )}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-white/[0.04] transition-[width] duration-700"
                style={{ width: `${(l.votes / top) * 100}%` }}
              />
              <span
                className={cn(
                  "relative w-16 font-mono font-semibold tabular-nums",
                  l.rank === 1 ? "text-5xl text-brand" : "text-3xl text-muted-foreground"
                )}
              >
                #{l.rank}
              </span>
              <Swatch colour={l.colour} className={l.rank === 1 ? "size-8" : "size-5"} />
              <span className="relative w-32 font-mono text-2xl text-muted-foreground">{l.printCode}</span>
              <span className={cn("relative min-w-0 flex-1 truncate font-semibold", l.rank === 1 ? "text-5xl" : "text-3xl")}>
                {l.title}
              </span>
              <span className={cn("relative max-w-96 truncate text-muted-foreground", l.rank === 1 ? "text-3xl" : "text-2xl")}>
                {l.displayName}
              </span>
              <span className={cn("relative w-40 text-right font-mono font-semibold tabular-nums", l.rank === 1 ? "text-5xl" : "text-3xl")}>
                {l.votes}
                <span className="ml-2 text-xl font-normal text-muted-foreground">vote{l.votes === 1 ? "" : "s"}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
