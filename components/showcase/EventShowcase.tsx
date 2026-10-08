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
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="lg:h-[44rem] lg:max-h-[44rem]">
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
          <Card className="gap-0 overflow-hidden p-0 shadow-none">
            <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 px-6 pt-5 pb-4">
              <h3 className="font-mono text-lg font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Designs so far
              </h3>
              <span className="font-mono text-lg tabular-nums text-muted-foreground">{data.designs.length}</span>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {data.designs.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {data.designs.map((design) => (
                    <DesignCard key={design.printCode} design={design} onSelect={selectDesign} />
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
