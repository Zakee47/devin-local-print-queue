"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { TvView } from "@/convex/settings";
import TvBoard, { EMPTY_BOARD } from "./TvBoard";
import TvDesignsBoard, { EMPTY_DESIGNS } from "./TvDesignsBoard";
import TvLayout from "./TvLayout";

export function parseTvView(view: string | undefined): TvView | null {
  if (view === "main") return "main";
  if (view === "projects" || view === "designs") return "projects";
  return null;
}

export default function TvScreen({ view }: { view: string | undefined }) {
  const router = useRouter();
  const boardData = useQuery(api.tv.board);
  const designsData = useQuery(api.tv.designs);
  const board = boardData ?? EMPTY_BOARD;
  const designs = designsData ?? EMPTY_DESIGNS;
  // Holds a click until router.replace delivers the new `view` prop.
  const [picked, setPicked] = useState<{ view: TvView; from: string | undefined } | null>(null);
  const active =
    (picked && picked.from === view ? picked.view : null) ??
    parseTvView(view) ??
    (boardData ?? designsData)?.defaultView ??
    "main";

  const select = (next: TvView) => {
    if (next === active) return;
    setPicked({ view: next, from: view });
    router.replace(`/tv?view=${next}`, { scroll: false });
  };

  const live = active === "projects" ? designs : board;
  return (
    <TvLayout
      counts={live.counts}
      notices={live.notices}
      tabs={{
        active,
        mainLabel: board.mode === "results" ? "Winner" : "Print queue",
        onSelect: select,
      }}
    >
      {active === "projects" ? <TvDesignsBoard board={designs} /> : <TvBoard board={board} />}
    </TvLayout>
  );
}
