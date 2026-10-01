import type { TvCounts } from "@/convex/tv";

const LABELS: [keyof TvCounts, string][] = [
  ["submitted", "Print requests"],
  ["queued", "Queued"],
  ["printing", "Printing"],
  ["done", "Done"],
];

export default function Counters({ counts }: { counts: TvCounts }) {
  return (
    <dl className="ml-auto flex shrink-0 overflow-hidden rounded-2xl border border-border bg-card">
      {LABELS.map(([key, label]) => (
        <div key={key} className="flex w-40 flex-col gap-0.5 border-l border-border px-6 py-2.5 first:border-0">
          <dt className="font-mono text-sm tracking-[0.18em] text-muted-foreground uppercase">{label}</dt>
          <dd
            key={counts[key]}
            className="font-heading text-4xl font-semibold tabular-nums animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            {counts[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
