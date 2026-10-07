import BrandMark from "@/components/BrandMark";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TvView } from "@/convex/settings";
import type { TvCounts } from "@/convex/tv";
import { CHALLENGE, EVENT_NAME } from "@/lib/event";
import Counters from "./Counters";

export type TvTabs = { active: TvView; mainLabel: string; onSelect: (view: TvView) => void };

export default function TvHeader({ counts, tabs }: { counts: TvCounts; tabs: TvTabs }) {
  return (
    <header className="flex items-center gap-6 border-b border-border px-8">
      <BrandMark className="size-12" />
      <div className="min-w-0">
        <p className="font-mono text-lg tracking-[0.18em] text-muted-foreground uppercase">{EVENT_NAME}</p>
        <p className="mt-1 truncate font-heading text-4xl font-semibold tracking-[-0.02em]">
          {CHALLENGE}. We&apos;ll print it.
        </p>
      </div>
      <ToggleGroup
        value={[tabs.active]}
        onValueChange={(value) => {
          const next = value[0];
          if (next === "main" || next === "projects") tabs.onSelect(next);
        }}
        aria-label="TV view"
        className="ml-auto shrink-0 gap-1 rounded-2xl border border-border bg-card p-1.5"
      >
        {(
          [
            ["main", tabs.mainLabel],
            ["projects", "Projects"],
          ] as const
        ).map(([value, label]) => (
          <ToggleGroupItem
            key={value}
            value={value}
            className="h-10 rounded-xl px-4 font-mono text-sm tracking-[0.14em] text-muted-foreground uppercase aria-pressed:bg-foreground aria-pressed:text-background hover:aria-pressed:bg-foreground"
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Counters counts={counts} />
    </header>
  );
}
