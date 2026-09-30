"use client";

import type { ReactNode } from "react";
import { Heart, Layers, X } from "lucide-react";
import type { GalleryEntry } from "@/convex/votes";
import type { Reaction } from "@/lib/event";
import LazyModelViewer from "@/components/vote/LazyModelViewer";
import { Button } from "@/components/ui/button";
import { swatchFor } from "@/lib/colours";
import { cn } from "@/lib/utils";

export default function VoteCard({
  entry,
  reaction,
  voted,
  voteControl,
  onOpen,
}: {
  entry: GalleryEntry;
  reaction?: Reaction;
  voted: boolean;
  voteControl: ReactNode;
  onOpen: () => void;
}) {
  const colour = swatchFor(entry.colour);
  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow",
        voted && "ring-2 ring-brand"
      )}
    >
      <LazyModelViewer url={entry.fileUrl} kind={entry.kind} colour={colour} />
      <div className="flex flex-1 flex-col gap-3 border-t border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-heading font-medium tracking-tight">{entry.title}</h2>
            <p className="truncate text-sm text-muted-foreground">{entry.displayName}</p>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-dim">{entry.printCode}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-3 rounded-full ring-1 ring-foreground/20"
              style={{ backgroundColor: colour }}
              aria-hidden
            />
            {entry.colour ?? "Any colour"}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {reaction === "like" ? (
              <>
                <Heart className="size-3.5 text-brand" aria-hidden />
                Liked
              </>
            ) : reaction === "skip" ? (
              <>
                <X className="size-3.5" aria-hidden />
                Skipped
              </>
            ) : null}
          </span>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          {voteControl}
          <Button variant="ghost" size="sm" onClick={onOpen} aria-label={`Open ${entry.title} in the swipe deck`}>
            <Layers data-icon="inline-start" />
            Open in deck
          </Button>
        </div>
      </div>
    </li>
  );
}
