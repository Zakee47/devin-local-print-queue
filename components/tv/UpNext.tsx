"use client";

import type { TvItem } from "@/convex/tv";
import { cn } from "@/lib/utils";
import Swatch from "./Swatch";
import { usePresence } from "./hooks";

const keyOf = (i: TvItem) => i.printCode;

export default function UpNext({ items, more }: { items: TvItem[]; more: number }) {
  const rows = usePresence(items, keyOf);
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card px-8 py-5">
      <h2 className="font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">Up next</h2>
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
                  "flex h-[40px] shrink-0 items-center gap-5 border-b border-border/70 text-[22px] last:border-0",
                  leaving
                    ? "animate-out fade-out slide-out-to-left-8 fill-mode-forwards duration-450"
                    : "animate-in fade-in slide-in-from-bottom-3 duration-500"
                )}
              >
                <span className="w-8 font-mono text-xl text-muted-dim tabular-nums">
                  {leaving ? "" : position + 1}
                </span>
                <span className="w-28 font-mono text-xl text-muted-foreground">{item.printCode}</span>
                <Swatch colour={item.colour} className="size-5" />
                <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                <span className="max-w-64 truncate text-muted-foreground">{item.displayName}</span>
              </li>
            );
          })}
        </ol>
      )}
      {more > 0 ? (
        <p className="mt-auto pt-2 font-mono text-xl text-muted-foreground">+{more} more in the queue</p>
      ) : null}
    </section>
  );
}
