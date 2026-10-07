"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Info } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useViewerAuth } from "@/lib/use-viewer-auth";
import type { Tour } from "@/lib/tutorials";
import TutorialDialog from "./TutorialDialog";

export default function HelpTour({
  tour,
  autoOpenPath,
}: {
  tour: Tour;
  autoOpenPath?: string;
}) {
  const pathname = usePathname();
  const { canQuery } = useViewerAuth();
  const seen = useQuery(api.tutorials.seen, canQuery ? { tour } : "skip");
  const markSeen = useMutation(api.tutorials.markSeen);
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const onAutoPath =
    autoOpenPath !== undefined &&
    (pathname === autoOpenPath || pathname.startsWith(`${autoOpenPath}/`));
  const open = manualOpen || (seen === false && onAutoPath && !dismissed);

  function close() {
    setManualOpen(false);
    setDismissed(true);
    if (seen === false) void markSeen({ tour }).catch(() => {});
  }

  return (
    <>
      <button
        type="button"
        aria-label="Replay tutorial"
        title="Replay tutorial"
        onClick={() => setManualOpen(true)}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Info aria-hidden className="size-4.5" />
      </button>
      <TutorialDialog tour={tour} open={open} onClose={close} />
    </>
  );
}
