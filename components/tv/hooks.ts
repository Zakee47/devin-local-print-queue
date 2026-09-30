"use client";

import { useEffect, useRef, useState } from "react";

// A clock that re-renders the caller every `intervalMs`.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// True once the pointer has been still for `idleMs`.
export function useIdle(idleMs = 3000) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), idleMs);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), idleMs);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, [idleMs]);
  return idle;
}

export type Presence<T> = { item: T; key: string; leaving: boolean };

// Keeps removed items around for `exitMs` flagged as leaving, so lists can
// animate entries out instead of cutting them.
export function usePresence<T>(items: T[], keyOf: (item: T) => string, exitMs = 450) {
  const [leaving, setLeaving] = useState<Map<string, { item: T; index: number }>>(new Map());
  const previous = useRef<T[]>(items);

  useEffect(() => {
    const prev = previous.current;
    previous.current = items;
    const current = new Set(items.map(keyOf));
    const gone = prev
      .map((item, index) => ({ item, index, key: keyOf(item) }))
      .filter((p) => !current.has(p.key));
    if (gone.length === 0) return;
    setLeaving((m) => {
      const next = new Map(m);
      for (const g of gone) next.set(g.key, { item: g.item, index: g.index });
      return next;
    });
    const timer = setTimeout(() => {
      setLeaving((m) => {
        const next = new Map(m);
        for (const g of gone) next.delete(g.key);
        return next;
      });
    }, exitMs);
    return () => clearTimeout(timer);
  }, [items, keyOf, exitMs]);

  const result: Presence<T>[] = items.map((item) => ({ item, key: keyOf(item), leaving: false }));
  const present = new Set(result.map((r) => r.key));
  for (const [key, { item, index }] of leaving) {
    if (present.has(key)) continue;
    result.splice(Math.min(index, result.length), 0, { item, key, leaving: true });
  }
  return result;
}

// Keys that newly appeared since the first render, highlighted for `holdMs`.
export function useArrivals(keys: string[], holdMs = 6000) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const signature = keys.join("|");

  useEffect(() => {
    const list = signature ? signature.split("|") : [];
    if (seen.current === null) {
      seen.current = new Set(list);
      return;
    }
    const known = seen.current;
    const arrived = list.filter((k) => !known.has(k));
    seen.current = new Set(list);
    if (arrived.length === 0) return;
    setFresh((s) => new Set([...s, ...arrived]));
    const timer = setTimeout(() => {
      setFresh((s) => new Set([...s].filter((k) => !arrived.includes(k))));
    }, holdMs);
    return () => clearTimeout(timer);
  }, [signature, holdMs]);

  return fresh;
}

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function timeAgo(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}
