"use client";

import { Check, Heart } from "lucide-react";
import type { GalleryEntry } from "@/convex/votes";
import LazyModelViewer from "@/components/vote/LazyModelViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { swatchFor } from "@/lib/colours";
import { cn } from "@/lib/utils";

export type VoteState =
  | { kind: "browse" }
  | { kind: "own" }
  | { kind: "voted"; canChange: boolean }
  | { kind: "available"; canVote: boolean };

export default function VoteCard({
  entry,
  state,
  pending,
  onVote,
  onRetract,
}: {
  entry: GalleryEntry;
  state: VoteState;
  pending: boolean;
  onVote: () => void;
  onRetract: () => void;
}) {
  const colour = swatchFor(entry.colour);
  const voted = state.kind === "voted";
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
          {state.kind === "own" ? (
            <Badge variant="outline">Your entry</Badge>
          ) : state.kind === "voted" ? (
            <Button
              variant="brand"
              size="sm"
              disabled={pending || !state.canChange}
              onClick={onRetract}
              aria-pressed
              aria-label={`Remove your vote for ${entry.title}`}
            >
              <Check data-icon="inline-start" />
              Voted
            </Button>
          ) : state.kind === "available" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !state.canVote}
              onClick={onVote}
              aria-pressed={false}
              aria-label={`Vote for ${entry.title}`}
            >
              <Heart data-icon="inline-start" />
              Vote
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
