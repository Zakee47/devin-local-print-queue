"use client";

import { Clock, Megaphone } from "lucide-react";
import type { TvNotices } from "@/convex/tv";
import { cn } from "@/lib/utils";
import { formatElapsed, useNow } from "./hooks";

export function submissionsStatus(notices: TvNotices, now: number) {
  const deadline = notices.submissionsDeadline;
  if (!notices.submissionsOpen || (deadline !== null && now >= deadline)) {
    return { closed: true, label: "Submissions closed" };
  }
  if (deadline !== null) return { closed: false, label: `Submissions close in ${formatElapsed(deadline - now)}` };
  return null;
}

// Announcement plus submissions countdown; hidden when there is nothing to say.
export default function Notices({ notices }: { notices: TvNotices }) {
  const now = useNow();
  const status = submissionsStatus(notices, now);
  if (!notices.announcement && !status) return null;
  return (
    <div className="mx-8 mt-6 flex h-[72px] items-center gap-8 rounded-2xl border border-brand/50 bg-brand/10 px-8">
      {notices.announcement ? (
        <p className="flex min-w-0 flex-1 items-center gap-4 text-3xl font-medium">
          <Megaphone className="size-7 shrink-0 text-brand" aria-hidden />
          <span className="truncate">{notices.announcement}</span>
        </p>
      ) : (
        <span className="flex-1" />
      )}
      {status ? (
        <p
          className={cn(
            "flex shrink-0 items-center gap-3 font-mono text-3xl font-semibold tabular-nums",
            status.closed ? "text-muted-foreground" : "text-foreground"
          )}
        >
          <Clock className={cn("size-7", status.closed ? "text-muted-foreground" : "text-brand")} aria-hidden />
          {status.label}
        </p>
      ) : null}
    </div>
  );
}
