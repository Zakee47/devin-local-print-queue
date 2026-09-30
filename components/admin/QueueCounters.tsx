"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const ITEMS = [
  { key: "review", label: "Waiting review" },
  { key: "queued", label: "Queued" },
  { key: "printing", label: "Printing" },
  { key: "done", label: "Done" },
] as const;

export default function QueueCounters() {
  const counts = useQuery(api.queue.counts);
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-4">
      {ITEMS.map((item) => (
        <div key={item.key} className="bg-card px-4 py-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="font-mono text-2xl font-semibold tabular-nums">
            {counts ? counts[item.key] : "–"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
