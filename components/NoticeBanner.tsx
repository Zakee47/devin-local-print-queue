"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Megaphone } from "lucide-react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { submissionsAreOpen } from "@/lib/event";
import { PAGE_WIDTHS, type PageWidth } from "@/lib/page-width";
import { cn } from "@/lib/utils";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// 12:34, 1:02:03, 2d 03:04:05
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export default function NoticeBanner({ width = "default" }: { width?: PageWidth }) {
  const settings = useQuery(api.settings.get);
  const announcement = settings?.announcement;
  const announcementUpdatedAt = settings?.announcementUpdatedAt;
  const settingsLoaded = settings !== undefined;
  const now = useNow();
  const previousAnnouncementUpdatedAt = useRef<number | undefined>(undefined);
  const hasLoadedSettings = useRef(false);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (hasLoadedSettings.current && announcementUpdatedAt !== previousAnnouncementUpdatedAt.current) {
      if (announcementUpdatedAt !== undefined && announcement) {
        toast("New message from the organisers", { description: announcement });
        let restartFrame = 0;
        const pulseFrame = requestAnimationFrame(() => {
          setPulsing(false);
          restartFrame = requestAnimationFrame(() => setPulsing(true));
        });
        const timeout = setTimeout(() => setPulsing(false), 6000);
        previousAnnouncementUpdatedAt.current = announcementUpdatedAt;
        return () => {
          cancelAnimationFrame(pulseFrame);
          cancelAnimationFrame(restartFrame);
          clearTimeout(timeout);
        };
      }
      const frame = requestAnimationFrame(() => setPulsing(false));
      previousAnnouncementUpdatedAt.current = announcementUpdatedAt;
      hasLoadedSettings.current = true;
      return () => cancelAnimationFrame(frame);
    }
    previousAnnouncementUpdatedAt.current = announcementUpdatedAt;
    hasLoadedSettings.current = true;
  }, [announcement, announcementUpdatedAt, settingsLoaded]);

  if (!settings) return null;
  const { submissionsDeadline } = settings;
  const open = submissionsAreOpen(settings, now);
  const counting = open && submissionsDeadline !== undefined;
  const closed = !open;
  if (!announcement && !counting && !closed) return null;

  return (
    <div role="region" aria-label="Event notices">
      {announcement ? (
        <div className={cn("bg-brand text-brand-foreground", pulsing && "animate-brand-pulse")}>
          <div
            className={cn(
              "mx-auto flex items-start gap-3 px-4 py-3 sm:px-6",
              PAGE_WIDTHS[width]
            )}
          >
            <Megaphone className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="mb-0.5 text-[0.7rem] font-mono font-semibold tracking-[0.16em] uppercase opacity-90">
                From the organisers
              </p>
              <p aria-live="polite" className="whitespace-pre-line text-base font-semibold">
                {announcement}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {counting || closed ? (
        <div className="border-y border-border bg-surface">
          <div
            className={cn(
              "mx-auto flex flex-col gap-1.5 px-4 py-2.5 text-sm sm:items-end sm:px-6",
              PAGE_WIDTHS[width]
            )}
          >
            {counting ? (
              <p
                className="flex shrink-0 items-center gap-2 font-medium"
                title={new Date(submissionsDeadline).toLocaleString()}
              >
                <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                Submissions close in{" "}
                <span className="font-mono tabular-nums" suppressHydrationWarning>
                  {formatCountdown(submissionsDeadline - now)}
                </span>
              </p>
            ) : closed ? (
              <p className="flex shrink-0 items-center gap-2 font-medium text-muted-foreground">
                <Clock className="size-4" aria-hidden="true" />
                Submissions are closed
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
