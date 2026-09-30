"use client";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { Heart, X } from "lucide-react";
import type { GalleryEntry } from "@/convex/votes";
import type { Reaction } from "@/lib/event";
import LazyModelViewer from "@/components/vote/LazyModelViewer";
import { swatchFor } from "@/lib/colours";
import { cn } from "@/lib/utils";

const SWIPE_DISTANCE = 96;
const SWIPE_VELOCITY = 0.5; // px per ms
const FLING_MS = 260;

export type SwipeCardHandle = { fling: (direction: Reaction) => void };

// The whole card is the drag surface. The 3D preview only auto-rotates and
// ignores pointers, so it never competes with the swipe gesture. `touch-action:
// pan-y` keeps vertical page scrolling native on phones.
const SwipeCard = forwardRef<
  SwipeCardHandle,
  {
    entry: GalleryEntry;
    reaction?: Reaction;
    voted: boolean;
    onSwipe: (direction: Reaction) => void;
    footer: ReactNode;
  }
>(function SwipeCard({ entry, reaction, voted, onSwipe, footer }, ref) {
  const cardRef = useRef<HTMLDivElement>(null);
  const likeRef = useRef<HTMLSpanElement>(null);
  const skipRef = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; dx: number } | null>(null);
  const flung = useRef(false);
  const colour = swatchFor(entry.colour);

  const paint = (dx: number, animate: boolean) => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = animate ? `transform ${FLING_MS}ms ease-out` : "none";
    card.style.transform = dx ? `translateX(${dx}px) rotate(${dx / 18}deg)` : "";
    const strength = Math.min(1, Math.abs(dx) / SWIPE_DISTANCE);
    if (likeRef.current) likeRef.current.style.opacity = dx > 0 ? String(strength) : "0";
    if (skipRef.current) skipRef.current.style.opacity = dx < 0 ? String(strength) : "0";
  };

  const fling = (direction: Reaction) => {
    if (flung.current) return;
    flung.current = true;
    const width = cardRef.current?.offsetWidth ?? 400;
    paint((direction === "like" ? 1 : -1) * width * 1.6, true);
    window.setTimeout(() => onSwipe(direction), FLING_MS);
  };

  useImperativeHandle(ref, () => ({ fling }));

  return (
    <div
      ref={cardRef}
      role="group"
      aria-roledescription="swipe card"
      aria-label={`${entry.title} by ${entry.displayName}`}
      className={cn(
        "relative flex w-full touch-pan-y flex-col overflow-hidden rounded-2xl bg-card shadow-xl ring-1 ring-foreground/10 select-none will-change-transform",
        voted && "ring-2 ring-brand"
      )}
      onPointerDown={(e) => {
        if (flung.current || (e.target as HTMLElement).closest("button,a")) return;
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0 };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        d.dx = e.clientX - d.x;
        paint(d.dx, false);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        drag.current = null;
        const velocity = d.dx / Math.max(1, e.timeStamp - d.t);
        if (Math.abs(d.dx) > SWIPE_DISTANCE || Math.abs(velocity) > SWIPE_VELOCITY) {
          fling(d.dx > 0 ? "like" : "skip");
        } else {
          paint(0, true);
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
        paint(0, true);
      }}
    >
      <div className="pointer-events-none relative">
        <LazyModelViewer url={entry.fileUrl} kind={entry.kind} colour={colour} className="aspect-[4/3] sm:aspect-square" />
        <span
          ref={likeRef}
          aria-hidden
          className="absolute top-5 left-5 -rotate-12 rounded-lg border-4 border-brand px-3 py-1 font-heading text-3xl font-bold tracking-wide text-brand uppercase opacity-0"
        >
          Like
        </span>
        <span
          ref={skipRef}
          aria-hidden
          className="absolute top-5 right-5 rotate-12 rounded-lg border-4 border-muted-foreground px-3 py-1 font-heading text-3xl font-bold tracking-wide text-muted-foreground uppercase opacity-0"
        >
          Skip
        </span>
        <div className="absolute top-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {voted ? <Pill className="bg-brand text-brand-foreground">Your vote</Pill> : null}
          {reaction === "like" ? (
            <Pill>
              <Heart className="size-3" aria-hidden />
              Liked
            </Pill>
          ) : reaction === "skip" ? (
            <Pill>
              <X className="size-3" aria-hidden />
              Skipped
            </Pill>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-xl font-medium tracking-tight">{entry.title}</h2>
            <p className="truncate text-sm text-muted-foreground">{entry.displayName}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="font-mono text-xs text-muted-dim">{entry.printCode}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="size-3 rounded-full ring-1 ring-foreground/20"
                style={{ backgroundColor: colour }}
                aria-hidden
              />
              {entry.colour ?? "Any colour"}
            </span>
          </div>
        </div>
        {footer}
      </div>
    </div>
  );
});

export default SwipeCard;

function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium ring-1 ring-foreground/10 backdrop-blur",
        className
      )}
    >
      {children}
    </span>
  );
}
