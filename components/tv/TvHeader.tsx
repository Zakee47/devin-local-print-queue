import Link from "next/link";
import { CognitionLogo, DevinLogo } from "@/components/landing/Logos";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TvView } from "@/convex/settings";
import type { TvCounts } from "@/convex/tv";
import { CHALLENGE, EVENT_HOME, EVENT_TITLE } from "@/lib/event";
import Counters from "./Counters";

export type TvTabs = { active: TvView; mainLabel: string; onSelect: (view: TvView) => void };

export default function TvHeader({ counts, tabs }: { counts: TvCounts; tabs: TvTabs }) {
  return (
    <header className="flex items-center gap-8 border-b border-border px-8 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-4">
          <Link
            href={EVENT_HOME}
            aria-label={`${EVENT_TITLE} home`}
            className="flex shrink-0 items-center gap-3 rounded-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <CognitionLogo className="h-7 w-auto" />
            <span aria-hidden="true" className="h-7 w-px bg-border" />
            <DevinLogo className="h-7 w-auto" />
          </Link>
          <p className="font-mono text-sm tracking-[0.18em] text-muted-foreground uppercase">{EVENT_TITLE}</p>
        </div>
        <p className="mt-3 truncate font-heading text-4xl leading-tight font-semibold tracking-[-0.02em]">
          {CHALLENGE}. We&apos;ll print it.
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-6">
        <ToggleGroup
          value={[tabs.active]}
          onValueChange={(value) => {
            const next = value[0];
            if (next === "main" || next === "projects") tabs.onSelect(next);
          }}
          aria-label="TV view"
          className="shrink-0 gap-1 rounded-2xl border border-border bg-card p-1.5"
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
      </div>
    </header>
  );
}
