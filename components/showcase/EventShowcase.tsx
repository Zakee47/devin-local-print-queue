"use client";

import { useState } from "react";
import type { Showcase } from "@/convex/tv";
import type { MyStanding } from "@/convex/votes";
import LiveLeaderboard from "@/components/leaderboard/LiveLeaderboard";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import DesignCard from "./DesignCard";
import DesignDialog from "./DesignDialog";

export default function EventShowcase({
  data,
  mine,
}: {
  data: Showcase;
  mine?: MyStanding;
}) {
  const [selectedPrintCode, setSelectedPrintCode] = useState<string | null>(null);
  const selectedDesign = data.designs.find((design) => design.printCode === selectedPrintCode) ?? null;
  const mineEntry = mine?.entries[0];
  const mineDisplayName = data.designs.find((design) => design.printCode === mineEntry?.printCode)?.displayName;
  const selectDesign = (printCode: string) => setSelectedPrintCode(printCode);

  return (
    <>
      <section aria-labelledby="showcase-heading" className="mx-auto mt-12 w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div>
          <p className="eyebrow text-muted-foreground">Projects</p>
          <h2 id="showcase-heading" className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Every design from London #01
          </h2>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="lg:h-[44rem]">
            <LiveLeaderboard
              variant="page"
              rows={data.leaderboard}
              totalVotes={data.totalVotes}
              totalLikes={data.totalLikes}
              mine={mine}
              mineDisplayName={mineDisplayName}
              votingOpen={data.votingOpen}
              votingNotOpenYet={data.votingNotOpenYet}
              onSelect={selectDesign}
              scrollable
              className="h-full"
            />
          </div>
          <Card className="gap-0 overflow-hidden p-0 shadow-none lg:h-[44rem] lg:min-h-0">
            <CardHeader className="shrink-0 gap-1 px-6 pt-5 pb-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  Designs so far
                </h3>
                <span className="font-mono text-lg tabular-nums text-muted-foreground">{data.designs.length}</span>
              </div>
              {data.designs.length > 1 ? (
                <p className="text-xs text-muted-foreground lg:hidden">Swipe to see all {data.designs.length}</p>
              ) : null}
            </CardHeader>
            <CardContent className="min-w-0 px-5 pb-5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto overscroll-contain">
              {data.designs.length ? (
                <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-x-visible lg:px-0 lg:snap-none xl:grid-cols-4">
                  {data.designs.map((design) => (
                    <div
                      key={design.printCode}
                      className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-auto"
                    >
                      <DesignCard design={design} onSelect={selectDesign} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Designs appear here as they&apos;re submitted.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
      <DesignDialog design={selectedDesign} onClose={() => setSelectedPrintCode(null)} />
    </>
  );
}
