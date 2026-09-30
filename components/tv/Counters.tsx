import type { TvCounts } from "@/convex/tv";

const LABELS: [keyof TvCounts, string][] = [
  ["submitted", "Submitted"],
  ["queued", "Queued"],
  ["printing", "Printing"],
  ["done", "Done"],
];

export default function Counters({ counts }: { counts: TvCounts }) {
  return (
    <dl className="grid shrink-0 grid-cols-4 overflow-hidden rounded-2xl border border-border bg-card">
      {LABELS.map(([key, label]) => (
        <div key={key} className="flex flex-col gap-1 border-l border-border px-7 py-4 first:border-0">
          <dt className="font-mono text-base tracking-[0.18em] text-muted-foreground uppercase">{label}</dt>
          <dd key={counts[key]} className="font-heading text-5xl font-semibold tabular-nums animate-in fade-in slide-in-from-bottom-2 duration-500">
            {counts[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
