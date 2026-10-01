"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
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

// Fixed 1920x1080 canvas scaled to fit the screen (letterboxed), never scrolls,
// and hides the cursor when the mouse is idle.
export default function TvStage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  const idle = useIdle();

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", fit);
      root.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 grid place-items-center overflow-hidden bg-background text-foreground",
        idle && "cursor-none [&_*]:cursor-none"
      )}
    >
      <div
        className={cn(
          "absolute top-3 right-3 z-10 rounded-full border border-border bg-background/80 p-1 backdrop-blur transition-opacity duration-300",
          idle ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        <ThemeToggle />
      </div>
      <div className="shrink-0" style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
        <div
          className="relative origin-top-left overflow-hidden bg-background"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
      <style>{FLASH_CSS}</style>
    </div>
  );
}
