import { Heart, Vote } from "lucide-react";
import VoteStamp from "@/components/vote/VoteStamp";

export default function VoteVsHeartArt() {
  return (
    <div className="tour-art tour-voting flex h-full min-w-0 flex-col justify-center gap-3 overflow-hidden px-3 py-4 sm:px-5">
      <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between gap-3">
          <span className="font-heading text-sm font-medium tracking-tight">Your ballot</span>
          <span className="font-mono text-[10px] tabular-nums">1 of 2 votes left</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="relative min-w-0 rounded-lg bg-brand/15 px-2.5 py-1.5 ring-1 ring-brand/40">
            <span className="block font-mono text-[9px] text-muted-foreground">Vote 1</span>
            <span className="block truncate text-xs font-medium">KC-007 Rocket</span>
            <span className="tour-stamp-drop">
              <VoteStamp voted voteNumber={1} animate={false} />
            </span>
          </div>
          <div className="min-w-0 rounded-lg border border-dashed border-border-strong px-2.5 py-1.5">
            <span className="block font-mono text-[9px] text-muted-foreground">Vote 2</span>
            <span className="block truncate text-xs text-muted-foreground">Empty</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="tour-cast-press flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-2 font-mono text-[10px] font-medium sm:px-3 sm:text-[11px] whitespace-nowrap text-brand-foreground">
          <Vote aria-hidden className="size-3.5 shrink-0" />
          Cast vote · 1 of 2 left
        </span>
        <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-[10px] whitespace-nowrap sm:px-2.5 sm:text-[11px] text-muted-foreground">
          <Heart aria-hidden className="size-3.5" />
          Like · tie-breaker
        </span>
      </div>
    </div>
  );
}
