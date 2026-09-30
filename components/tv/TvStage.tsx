"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useIdle } from "./hooks";

// Highlight for an item that just started printing or just finished.
const FLASH_CSS = `
@keyframes tv-flash {
  0%, 100% { box-shadow: 0 0 0 0 rgb(70 123 247 / 0); border-color: var(--border); }
  15%, 55% { box-shadow: 0 0 0 6px rgb(70 123 247 / 0.45), 0 0 48px 8px rgb(70 123 247 / 0.35); border-color: var(--brand); }
}
.tv-flash { animation: tv-flash 2s ease-in-out 3; }
@media (prefers-reduced-motion: reduce) { .tv-flash { animation: none; border-color: var(--brand); } }
`;

export const STAGE_W = 1920;
export const STAGE_H = 1080;

// Fixed 1920x1080 canvas scaled to fit the screen (letterboxed), always dark,
// never scrolls, and hides the cursor when the mouse is idle.
export default function TvStage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  const idle = useIdle();

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    const prevScheme = root.style.colorScheme;
    root.style.overflow = "hidden";
    root.style.colorScheme = "dark";
    return () => {
      window.removeEventListener("resize", fit);
      root.style.overflow = prevOverflow;
      root.style.colorScheme = prevScheme;
    };
  }, []);

  return (
    <div
      className={cn(
        "dark fixed inset-0 z-40 grid place-items-center overflow-hidden bg-black text-foreground",
        idle && "cursor-none [&_*]:cursor-none"
      )}
    >
      <div
        className="relative shrink-0 overflow-hidden bg-background"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
      >
        {children}
      </div>
      <style>{FLASH_CSS}</style>
    </div>
  );
}
