"use client";

import type { ReactNode } from "react";
import type { TvCounts, TvNotices } from "@/convex/tv";
import Notices from "./Notices";
import QrRail from "./QrRail";
import TvHeader, { type TvTabs } from "./TvHeader";
import TvStage from "./TvStage";

export default function TvLayout({
  counts,
  notices,
  tabs,
  children,
}: {
  counts: TvCounts;
  notices: TvNotices;
  tabs: TvTabs;
  children: ReactNode;
}) {
  return (
    <TvStage>
      <div className="grid h-full grid-cols-[1fr_340px]">
        <div className="grid min-h-0 min-w-0 grid-rows-[136px_auto_1fr]">
          <TvHeader counts={counts} tabs={tabs} />
          <Notices notices={notices} />
          {children}
        </div>
        <QrRail />
      </div>
    </TvStage>
  );
}
