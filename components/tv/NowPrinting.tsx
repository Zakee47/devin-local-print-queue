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
}: {
  items: TvPrintingItem[];
  now: number;
  fresh: Set<string>;
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
    <section className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dotgrid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)]"
      />
      <header className="relative flex items-center justify-between px-10 pt-9">
        <span className="flex items-center gap-3 font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">
          <span className="size-3 rounded-full bg-brand animate-brand-pulse" />
          Now printing
        </span>
        {items.length > 1 ? (
          <span className="flex items-center gap-3 font-mono text-lg text-muted-foreground">
            Printer {index + 1} of {items.length}
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
              className="absolute inset-0 m-auto size-[520px] rounded-full opacity-25 blur-3xl"
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
              "relative mx-6 mb-6 flex items-end justify-between gap-8 rounded-xl border border-border bg-background/80 px-8 py-7 backdrop-blur",
              fresh.has(current.printCode) && "tv-flash"
            )}
          >
            <div className="min-w-0">
              <p className="font-mono text-2xl font-medium tracking-[0.12em] text-brand">{current.printCode}</p>
              <h2 className="mt-2 truncate font-heading text-6xl leading-none font-semibold tracking-[-0.03em]">
                {current.title}
              </h2>
              <p className="mt-4 flex items-center gap-3 text-3xl text-muted-foreground">
                by <span className="text-foreground">{current.displayName}</span>
                {current.colour ? (
                  <>
                    <span className="text-border-strong">·</span>
                    <Swatch colour={current.colour} className="size-6" />
                    {current.colour}
                  </>
                ) : null}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-base tracking-[0.18em] text-muted-foreground uppercase">Elapsed</p>
              <p className="mt-1 font-mono text-6xl font-medium tabular-nums">
                {formatElapsed(now - (current.printingAt ?? now))}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <Printer className="size-32 text-muted-dim" strokeWidth={1} />
          <p className="font-heading text-5xl font-semibold tracking-[-0.02em]">The printer is warming up</p>
          <p className="text-2xl text-muted-foreground">The next keychain will appear here.</p>
        </div>
      )}
    </section>
  );
}
