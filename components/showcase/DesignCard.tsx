"use client";

import { Box } from "lucide-react";
import type { ShowcaseDesign } from "@/convex/tv";
import Swatch from "@/components/tv/Swatch";

export default function DesignCard({
  design,
  onSelect,
}: {
  design: ShowcaseDesign;
  onSelect: (printCode: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(design.printCode)}
      className="group w-full overflow-hidden rounded-xl border border-border bg-background text-left transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="aspect-square bg-surface">
        {design.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={design.previewUrl}
            alt={`${design.title} by ${design.displayName}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full object-contain transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <Box aria-hidden className="size-8" />
          </div>
        )}
      </div>
      <div className="flex h-[76px] flex-col justify-center gap-1 px-3">
        <p className="flex items-center gap-2 font-mono text-xs font-medium tracking-wider text-brand">
          <span className="truncate">{design.printCode}</span>
          <Swatch colour={design.colour} className="size-3" />
        </p>
        <p className="truncate text-sm font-medium leading-tight" title={design.title}>
          {design.title}
        </p>
        <p className="truncate text-xs leading-tight text-muted-foreground" title={design.displayName}>
          {design.displayName}
        </p>
      </div>
    </button>
  );
}
