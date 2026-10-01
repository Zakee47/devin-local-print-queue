"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TvRanked } from "@/convex/tv";

export type RankMotionChange = {
  moved: number;
  votesDelta: number;
  likesDelta: number;
  isNew: boolean;
};

export function useRankMotion(rows: TvRanked[], holdMs = 5000) {
  const [changes, setChanges] = useState<Map<string, RankMotionChange>>(() => new Map());
  const elements = useRef(new Map<string, HTMLElement>());
  const previousRows = useRef<TvRanked[] | null>(null);
  const previousSignature = useRef<string | null>(null);
  const previousTops = useRef(new Map<string, number>());
  const activeChanges = useRef(new Map<string, RankMotionChange>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const renderFrame = useRef<number | null>(null);
  const signature = rows
    .map((row) => `${row.printCode}:${row.rank}:${row.votes}:${row.likes}`)
    .join("|");

  const register = useCallback(
    (key: string) => (element: HTMLElement | null) => {
      if (element) elements.current.set(key, element);
      else elements.current.delete(key);
    },
    []
  );

  useLayoutEffect(() => {
    if (previousSignature.current === signature) return;
    const previous = previousRows.current;
    const currentKeys = new Set(rows.map((row) => row.printCode));
    let changed = false;

    for (const [key, timer] of timers.current) {
      if (currentKeys.has(key)) continue;
      clearTimeout(timer);
      timers.current.delete(key);
    }
    for (const key of activeChanges.current.keys()) {
      if (currentKeys.has(key)) continue;
      activeChanges.current.delete(key);
      changed = true;
    }

    if (previous) {
      rows.forEach((row, index) => {
        const previousIndex = previous.findIndex((item) => item.printCode === row.printCode);
        const old = previous[previousIndex];
        const change: RankMotionChange = old
          ? {
              moved: previousIndex - index,
              votesDelta: row.votes - old.votes,
              likesDelta: row.likes - old.likes,
              isNew: false,
            }
          : { moved: 0, votesDelta: 0, likesDelta: 0, isNew: true };
        if (!change.isNew && change.moved === 0 && change.votesDelta === 0 && change.likesDelta === 0) return;
        activeChanges.current.set(row.printCode, change);
        const existing = timers.current.get(row.printCode);
        if (existing) clearTimeout(existing);
        timers.current.set(
          row.printCode,
          setTimeout(() => {
            timers.current.delete(row.printCode);
            activeChanges.current.delete(row.printCode);
            setChanges(new Map(activeChanges.current));
          }, holdMs)
        );
        changed = true;
      });
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nextTops = new Map<string, number>();
    const movedElements: HTMLElement[] = [];
    for (const [key, element] of elements.current) {
      const top = element.getBoundingClientRect().top;
      const previousTop = previousTops.current.get(key);
      nextTops.set(key, top);
      if (reducedMotion || previousTop === undefined || Math.abs(previousTop - top) < 0.5) continue;
      element.style.setProperty("transition", "none");
      element.style.setProperty("transform", `translateY(${previousTop - top}px)`);
      movedElements.push(element);
    }
    previousTops.current = nextTops;
    if (movedElements.length > 0) {
      movedElements[0].getBoundingClientRect();
      for (const element of movedElements) {
        element.style.setProperty("transition", "transform 700ms cubic-bezier(0.22,1,0.36,1)");
        element.style.removeProperty("transform");
      }
    }

    previousRows.current = rows.map((row) => ({ ...row }));
    previousSignature.current = signature;
    if (changed) {
      if (renderFrame.current !== null) cancelAnimationFrame(renderFrame.current);
      renderFrame.current = requestAnimationFrame(() => {
        renderFrame.current = null;
        setChanges(new Map(activeChanges.current));
      });
    }
  }, [holdMs, rows, signature]);

  useEffect(
    () => () => {
      if (renderFrame.current !== null) cancelAnimationFrame(renderFrame.current);
      for (const timer of timers.current.values()) clearTimeout(timer);
    },
    []
  );

  return { register, changes };
}
