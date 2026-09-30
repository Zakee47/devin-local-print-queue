"use client";

import { useEffect, useState } from "react";

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const firstRefresh = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(firstRefresh);
      clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
}
