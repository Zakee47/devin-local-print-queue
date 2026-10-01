"use client";

import type { TvItem } from "@/convex/tv";
import { cn } from "@/lib/utils";
import Swatch from "./Swatch";
import { usePresence } from "./hooks";

const keyOf = (i: TvItem) => i.printCode;

export default function UpNext({
  items,
  more,
  compact = false,
}: {
  items: TvItem[];
  more: number;
  compact?: boolean;
}) {
  const rows = usePresence(items, keyOf);
  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card", compact ? "shrink-0 px-6 py-4" : "flex-1 px-8 py-5")}>
      <h2 className="font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Up next
      </h2>
      {items.length === 0 && rows.length === 0 ? (
        <p className="mt-6 text-2xl text-muted-foreground">Queue is empty. Submit yours!</p>
      ) : (
        <ol className="mt-2 flex flex-col">
          {rows.map(({ item, key, leaving }) => {
            const position = items.findIndex((i) => i.printCode === key);
            return (
              <li
                key={key}
                className={cn(
                  "flex h-[40px] shrink-0 items-center gap-5 border-b border-border/70 last:border-0",
                  compact ? "text-xl" : "text-[22px]",
                  leaving
                    ? "animate-out fade-out slide-out-to-left-8 fill-mode-forwards duration-450"
                    : "animate-in fade-in slide-in-from-bottom-3 duration-500"
                )}
              >
                <span className="w-8 font-mono text-xl text-muted-dim tabular-nums">
                  {leaving ? "" : position + 1}
                </span>
                <span className={cn("font-mono text-xl text-muted-foreground", compact ? "w-24" : "w-28")}>
                  {item.printCode}
                </span>
                <Swatch colour={item.colour} className="size-5" />
                <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                <span className={cn("truncate text-muted-foreground", compact ? "max-w-36" : "max-w-64")}>
                  {item.displayName}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {more > 0 ? (
        <p className={cn("pt-2 font-mono text-xl text-muted-foreground", compact ? "mt-3" : "mt-auto")}>
          +{more} more in the queue
        </p>
      ) : null}
    </section>
  );
}
