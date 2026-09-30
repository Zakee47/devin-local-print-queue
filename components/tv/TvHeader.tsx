import BrandMark from "@/components/BrandMark";
import type { TvCounts } from "@/convex/tv";
import { CHALLENGE, EVENT_NAME } from "@/lib/event";
import Counters from "./Counters";

export default function TvHeader({ counts }: { counts: TvCounts }) {
  return (
    <header className="flex items-center gap-7 border-b border-border px-8">
      <BrandMark className="size-12" />
      <div className="min-w-0">
        <p className="font-mono text-lg tracking-[0.18em] text-muted-foreground uppercase">{EVENT_NAME}</p>
        <p className="mt-1 truncate font-heading text-4xl font-semibold tracking-[-0.02em]">
          {CHALLENGE}. We&apos;ll print it.
        </p>
      </div>
      <Counters counts={counts} />
    </header>
  );
}
