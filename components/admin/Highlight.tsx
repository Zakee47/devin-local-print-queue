import type { ReactNode } from "react";
import { highlightRanges } from "@/components/admin/queue-view";

export default function Highlight({ text, query }: { text: string; query?: string }) {
  const ranges = highlightRanges(text, query ?? "");
  if (!ranges.length) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} className="rounded-sm bg-yellow-200 px-px text-inherit dark:bg-yellow-500/40">
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
