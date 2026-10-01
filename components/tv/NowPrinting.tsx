"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import type { TvPrintingItem } from "@/convex/tv";
import ModelViewer from "@/components/ModelViewer";
import { swatchFor } from "@/lib/colours";
import { cn } from "@/lib/utils";
import Swatch from "./Swatch";
import { formatElapsed } from "./hooks";

const CYCLE_MS = 12_000;

export default function NowPrinting({
  items,
  now,
  fresh,
  compact = false,
}: {
  items: TvPrintingItem[];
  now: number;
  fresh: Set<string>;
  compact?: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setTick((t) => t + 1), CYCLE_MS);
    return () => clearInterval(id);
  }, [items.length]);

  // A fresh arrival jumps to the front of the rotation.
  const freshIndex = items.findIndex((i) => fresh.has(i.printCode));
  const index = items.length === 0 ? 0 : freshIndex >= 0 ? freshIndex : tick % items.length;
  const current = items[index];

  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card",
        compact ? "min-h-0 flex-1" : "h-full"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dotgrid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)]"
      />
      <header className={cn("relative flex items-center justify-between", compact ? "px-6 pt-6" : "px-10 pt-9")}>
        <span className="flex items-center gap-3 font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">
          <span className="size-3 rounded-full bg-brand animate-brand-pulse" />
          Now printing
        </span>
        {items.length > 1 ? (
          <span className="flex items-center gap-3 font-mono text-lg text-muted-foreground">
            {index + 1} of {items.length}
            <span className="flex gap-2">
              {items.map((i, n) => (
                <span
                  key={i.printCode}
                  className={cn(
                    "size-2.5 rounded-full transition-colors duration-500",
                    n === index ? "bg-foreground" : "bg-border-strong"
                  )}
                />
              ))}
            </span>
          </span>
        ) : null}
      </header>

      {current ? (
        <div key={current.printCode} className="relative flex flex-1 flex-col animate-in fade-in duration-700">
          <div className="relative flex-1">
            <div
              aria-hidden
              className={cn("absolute inset-0 m-auto rounded-full opacity-25 blur-3xl", compact ? "size-[300px]" : "size-[520px]")}
              style={{ backgroundColor: swatchFor(current.colour ?? undefined) }}
            />
            {current.file ? (
              <ModelViewer
                url={current.file.url}
                kind={current.file.kind}
                colour={swatchFor(current.colour ?? undefined)}
                className="absolute inset-0 aspect-auto h-full"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                <Printer className="size-40" strokeWidth={1} />
              </div>
            )}
          </div>
          <div
            className={cn(
              "relative flex items-end justify-between gap-8 rounded-xl border border-border bg-background/80 backdrop-blur",
              compact ? "mx-4 mb-4 flex-col items-stretch gap-4 px-6 py-5" : "mx-6 mb-6 px-8 py-7",
              fresh.has(current.printCode) && "tv-flash"
            )}
          >
            <div className="min-w-0">
              <p className={cn("font-mono font-medium tracking-[0.12em] text-brand", compact ? "text-lg" : "text-2xl")}>
                {current.printCode}
                {current.printer ? (
                  <span className="ml-2 inline-flex items-center gap-2 align-middle tracking-normal text-foreground">
                    <span className="text-border-strong">·</span>
                    <Printer className={compact ? "size-5" : "size-6"} aria-hidden="true" />
                    {current.printer}
                  </span>
                ) : null}
              </p>
              <h2
                className={cn(
                  "mt-2 font-heading leading-[1.05] font-semibold tracking-[-0.03em]",
                  compact ? "line-clamp-1 text-3xl" : "line-clamp-2 text-5xl"
                )}
              >
                {current.title}
              </h2>
              <p className={cn("mt-3 flex min-w-0 items-center gap-2 text-muted-foreground", compact ? "truncate text-xl" : "mt-4 gap-3 text-3xl")}>
                by <span className="text-foreground">{current.displayName}</span>
                {current.colour ? (
                  <>
                    <span className="text-border-strong">·</span>
                    <Swatch colour={current.colour} className={compact ? "size-5" : "size-6"} />
                    {current.colour}
                  </>
                ) : null}
              </p>
            </div>
            <div className={cn("shrink-0", compact ? "text-left" : "text-right")}>
              <p className={cn("font-mono tracking-[0.18em] text-muted-foreground uppercase", compact ? "text-xs" : "text-base")}>
                Elapsed
              </p>
              <p className={cn("mt-1 font-mono font-medium tabular-nums", compact ? "text-3xl" : "text-6xl")}>
                {formatElapsed(now - (current.printingAt ?? now))}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <Printer className={cn("text-muted-dim", compact ? "size-20" : "size-32")} strokeWidth={1} />
          <p className={cn("font-heading font-semibold tracking-[-0.02em]", compact ? "text-3xl" : "text-5xl")}>
            The printer is warming up
          </p>
          <p className={cn("text-muted-foreground", compact ? "text-xl" : "text-2xl")}>
            The next keychain will appear here.
          </p>
        </div>
      )}
    </section>
  );
}
