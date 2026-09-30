"use client";

import type { TvItem } from "@/convex/tv";
import { cn } from "@/lib/utils";
import Swatch from "./Swatch";
import { timeAgo } from "./hooks";

export default function FreshOff({ items, now, fresh }: { items: TvItem[]; now: number; fresh: Set<string> }) {
  return (
    <section className="flex shrink-0 flex-col rounded-2xl border border-border bg-card px-8 py-4">
      <h2 className="font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Fresh off the printer
      </h2>
      {items.length === 0 ? (
        <p className="mt-6 text-2xl text-muted-foreground">Nothing finished yet.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-4">
          {items.map((item) => (
            <li
              key={item.printCode}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-background px-5 py-3 animate-in fade-in zoom-in-95 duration-500",
                fresh.has(item.printCode) && "tv-flash"
              )}
            >
              <span className="flex items-center gap-3">
                <Swatch colour={item.colour} />
                <span className="font-mono text-lg text-muted-foreground">{item.printCode}</span>
                <span className="ml-auto font-mono text-base text-muted-dim">
                  {item.doneAt ? timeAgo(now - item.doneAt) : ""}
                </span>
              </span>
              <span className="truncate text-2xl font-medium">{item.title}</span>
              <span className="truncate text-xl text-muted-foreground">{item.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
