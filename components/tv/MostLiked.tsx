"use client";

import { Heart } from "lucide-react";
import type { TvLiked } from "@/convex/tv";
import Swatch from "./Swatch";

export default function MostLiked({ items }: { items: TvLiked[] }) {
  return (
    <section className="flex shrink-0 flex-col gap-3 rounded-2xl border border-border bg-card px-8 py-5">
      <h2 className="flex shrink-0 items-center gap-3 font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">
        <Heart className="size-5 text-brand" aria-hidden />
        Most liked
      </h2>
      {items.length === 0 ? (
        <p className="text-xl text-muted-foreground">No likes yet. Swipe at /vote.</p>
      ) : (
        <ol className="grid grid-cols-5 gap-3">
          {items.map((item, i) => (
            <li
              key={item.printCode}
              className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 animate-in fade-in duration-500"
            >
              <span className="font-mono text-base text-muted-dim tabular-nums">{i + 1}</span>
              <Swatch colour={item.colour} />
              <span className="min-w-0 flex-1 truncate text-lg text-muted-foreground">{item.displayName}</span>
              <span className="font-mono text-lg font-semibold tabular-nums">{item.likes}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
