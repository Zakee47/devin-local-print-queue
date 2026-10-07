"use client";

import type { ReactNode } from "react";
import { Heart, Layers, X } from "lucide-react";
import type { GalleryEntry } from "@/convex/votes";
import type { Reaction } from "@/lib/event";
import ModelPreview from "@/components/ModelPreview";
import StageChip from "@/components/vote/StageChip";
import VoteStamp from "@/components/vote/VoteStamp";
import { Button } from "@/components/ui/button";
import { swatchFor } from "@/lib/colours";
import { cn } from "@/lib/utils";

export default function VoteCard({
  entry,
  reaction,
  voted,
  voteNumber,
  canReact,
  onToggleLike,
  voteControl,
  ownStanding,
  onOpen,
}: {
  entry: GalleryEntry;
  reaction?: Reaction;
  voted: boolean;
  voteNumber?: number;
  canReact: boolean;
  onToggleLike: () => void;
  voteControl: ReactNode;
  ownStanding?: { rank: number; totalEntries: number; votes: number };
  onOpen?: () => void;
}) {
  const colour = swatchFor(entry.colour);
  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow",
        voted && "ring-2 ring-brand"
      )}
    >
      <div className="relative" data-stamp-host>
        <ModelPreview
          url={entry.fileUrl}
          previewUrl={entry.previewUrl}
          kind={entry.kind}
          colour={colour}
          alt={entry.title}
        />
        <StageChip stage={entry.stage} className="pointer-events-none absolute top-3 left-3" />
        <VoteStamp voted={voted} voteNumber={voteNumber} />
      </div>
      <div className="flex flex-1 flex-col gap-3 border-t border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-heading font-medium tracking-tight">{entry.title}</h2>
            <p className="truncate text-sm text-muted-foreground">{entry.displayName}</p>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-dim">{entry.printCode}</span>
        </div>
        {ownStanding ? (
          <div className="flex flex-col gap-2">
            <span className="w-fit rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-brand/30">
              Your entry · you can&apos;t vote for your own
            </span>
            <p className="font-mono text-xs text-muted-foreground">
              #{ownStanding.rank} of {ownStanding.totalEntries} · {ownStanding.votes}{" "}
              {ownStanding.votes === 1 ? "vote" : "votes"}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="size-3 rounded-full ring-1 ring-foreground/20"
                style={{ backgroundColor: colour }}
                aria-hidden
              />
              {entry.colour ?? "Any colour"}
            </span>
            {canReact ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={onToggleLike}
                aria-pressed={reaction === "like"}
                className="text-muted-foreground"
              >
                <Heart className={cn("size-3.5", reaction === "like" && "fill-current")} aria-hidden />
                {reaction === "like" ? "Liked · tie-breaker" : "Like · tie-breaker"}
              </Button>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {reaction === "like" ? (
                  <>
                    <Heart className="size-3.5" aria-hidden />
                    Liked
                  </>
                ) : reaction === "skip" ? (
                  <>
                    <X className="size-3.5" aria-hidden />
                    Skipped
                  </>
                ) : null}
              </span>
            )}
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2">
          {ownStanding ? (
            onOpen ? (
              <Button variant="outline" size="sm" onClick={onOpen}>
                View entry
              </Button>
            ) : null
          ) : (
            <>
              {voteControl}
              {onOpen ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpen}
                  aria-label={`Open ${entry.title} in the swipe deck`}
                >
                  <Layers data-icon="inline-start" />
                  Open in deck
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
