"use client";

import { Heart, Trophy } from "lucide-react";
import type { TvWinner } from "@/convex/tv";
import ModelViewer from "@/components/ModelViewer";
import { swatchFor } from "@/lib/colours";
import Swatch from "./Swatch";

export default function Winner({ winner, totalVotes }: { winner: TvWinner | null; totalVotes: number }) {
  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-brand/60 bg-card">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dotgrid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)]"
      />
      <header className="relative flex items-center justify-between px-10 pt-9">
        <span className="flex items-center gap-3 font-mono text-lg font-medium tracking-[0.18em] text-brand uppercase">
          <Trophy className="size-6" aria-hidden />
          Winner
        </span>
        <span className="font-mono text-2xl text-muted-foreground tabular-nums">
          {totalVotes} vote{totalVotes === 1 ? "" : "s"} cast
        </span>
      </header>
      {winner ? (
        <div key={winner.printCode} className="relative flex flex-1 flex-col animate-in fade-in zoom-in-95 duration-700">
          <div className="relative flex-1">
            <div
              aria-hidden
              className="absolute inset-0 m-auto size-[560px] rounded-full opacity-30 blur-3xl"
              style={{ backgroundColor: swatchFor(winner.colour ?? undefined) }}
            />
            {winner.file ? (
              <ModelViewer
                url={winner.file.url}
                kind={winner.file.kind}
                colour={swatchFor(winner.colour ?? undefined)}
                className="absolute inset-0 aspect-auto h-full"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-brand">
                <Trophy className="size-48" strokeWidth={1} />
              </div>
            )}
          </div>
          <div className="relative mx-6 mb-6 flex items-end justify-between gap-8 rounded-xl border border-brand/60 bg-background/80 px-8 py-7 backdrop-blur">
            <div className="min-w-0">
              <p className="flex items-center gap-3 font-mono text-2xl font-medium tracking-[0.12em] text-brand">
                <Swatch colour={winner.colour} className="size-6" />
                {winner.printCode}
              </p>
              <h1 className="mt-3 truncate font-heading text-7xl leading-none font-semibold tracking-[-0.03em]">
                {winner.title}
              </h1>
              <p className="mt-4 truncate text-4xl text-muted-foreground">
                by <span className="text-foreground">{winner.displayName}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-8xl leading-none font-semibold tabular-nums">{winner.votes}</p>
              <p className="mt-2 font-mono text-xl text-muted-foreground">
                vote{winner.votes === 1 ? "" : "s"}
                <span className="ml-4 inline-flex items-center gap-1.5">
                  <Heart className="size-5 text-brand" aria-hidden />
                  {winner.likes}
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <Trophy className="size-32 text-muted-dim" strokeWidth={1} />
          <p className="font-heading text-5xl font-semibold tracking-[-0.02em]">No votes yet</p>
          <p className="text-2xl text-muted-foreground">Vote for your two favourite designs.</p>
        </div>
      )}
    </section>
  );
}
