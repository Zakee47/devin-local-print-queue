"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { TvCollageItem } from "@/convex/tv";
import { cn } from "@/lib/utils";
import Swatch from "./Swatch";
import { useArrivals } from "./hooks";

const COLUMN_COUNT = 3;
const COLUMN_GAP = 12;
const TILE_CAPTION_HEIGHT = 76;
const TILE_SECONDS = 6;

const COLLAGE_CSS = `
@keyframes tv-collage-scroll {
  to { transform: translateY(-50%); }
}
.tv-collage-scroll {
  animation: tv-collage-scroll var(--collage-duration) linear infinite;
}
.tv-collage-scroll-reverse {
  animation-direction: reverse;
}
@media (prefers-reduced-motion: reduce) {
  .tv-collage-scroll { animation: none; }
}
`;

export default function Collage({ items }: { items: TvCollageItem[] }) {
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const [bodySize, setBodySize] = useState({ width: 0, height: 0 });
  const columns = useMemo(() => {
    const groups: TvCollageItem[][] = Array.from({ length: COLUMN_COUNT }, () => []);
    items.forEach((item, index) => groups[index % COLUMN_COUNT].push(item));
    groups.forEach((group, index) => {
      if (group.length === 0 && items.length > 0) group.push(items[index % items.length]);
    });
    return groups;
  }, [items]);
  const fresh = useArrivals(items.map((item) => item.printCode));

  useEffect(() => {
    if (!body) return;
    const updateSize = () => {
      const rect = body.getBoundingClientRect();
      const next = { width: rect.width, height: rect.height };
      setBodySize((current) =>
        current.width === next.width && current.height === next.height ? current : next
      );
    };
    updateSize();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(body);
    return () => observer.disconnect();
  }, [body]);

  const columnWidth = Math.max(0, (bodySize.width - COLUMN_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT);
  const tileStep = columnWidth + TILE_CAPTION_HEIGHT + COLUMN_GAP;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex shrink-0 items-center justify-between px-6 pt-5 pb-4">
        <h2 className="font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Designs so far
        </h2>
        <span className="font-mono text-lg tabular-nums text-muted-foreground">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center px-8 text-center">
          <p className="text-2xl text-muted-foreground">Designs appear here as they&apos;re submitted.</p>
        </div>
      ) : (
        <div ref={setBody} className="grid min-h-0 flex-1 grid-cols-3 gap-3 px-5 pb-5">
          {columns.map((column, columnIndex) => {
            const neededTiles = tileStep > 0 ? Math.ceil((bodySize.height + 1) / tileStep) : column.length;
            const cycles = Math.max(1, Math.ceil(neededTiles / column.length));
            const sequence = Array.from(
              { length: column.length * cycles },
              (_, index) => column[index % column.length]
            );
            const overflows = bodySize.height > 0 && sequence.length * tileStep > bodySize.height;
            const style = {
              "--collage-duration": `${sequence.length * TILE_SECONDS}s`,
            } as CSSProperties;

            return (
              <div key={columnIndex} className="min-h-0 min-w-0 overflow-hidden">
                <div
                  className={cn(
                    "flex flex-col gap-3",
                    overflows && "pb-3",
                    overflows && "tv-collage-scroll",
                    overflows && columnIndex === 1 && "tv-collage-scroll-reverse"
                  )}
                  style={style}
                >
                  {[...sequence, ...sequence].map((item, index) => (
                    <DesignTile
                      key={`${item.printCode}-${index}`}
                      item={item}
                      fresh={fresh.has(item.printCode)}
                      ariaHidden={index >= sequence.length}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{COLLAGE_CSS}</style>
    </section>
  );
}

function DesignTile({
  item,
  fresh,
  ariaHidden,
}: {
  item: TvCollageItem;
  fresh: boolean;
  ariaHidden: boolean;
}) {
  return (
    <article
      aria-hidden={ariaHidden}
      className={cn("shrink-0 overflow-hidden rounded-xl border border-border bg-background", fresh && "tv-flash")}
    >
      <div className="aspect-square bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.previewUrl}
          alt={`${item.title} by ${item.displayName}`}
          loading="eager"
          decoding="async"
          draggable={false}
          className="size-full object-contain"
        />
      </div>
      <div className="flex h-[76px] flex-col justify-center gap-1 px-3">
        <p className="flex items-center gap-2 font-mono text-xs font-medium tracking-wider text-brand">
          <span className="truncate">{item.printCode}</span>
          <Swatch colour={item.colour} className="size-3" />
        </p>
        <p className="truncate text-sm font-medium leading-tight" title={item.title}>
          {item.title}
        </p>
        <p className="truncate text-xs leading-tight text-muted-foreground" title={item.displayName}>
          {item.displayName}
        </p>
      </div>
    </article>
  );
}
