import { Box, Check, Printer } from "lucide-react";
import type { EntryStage } from "@/convex/votes";
import { cn } from "@/lib/utils";

const STAGES: Record<EntryStage, { label: string; icon: typeof Box; className: string }> = {
  design: { label: "Design", icon: Box, className: "text-muted-foreground" },
  printing: { label: "Printing", icon: Printer, className: "text-foreground" },
  printed: { label: "Printed", icon: Check, className: "text-brand" },
};

export default function StageChip({ stage, className }: { stage: EntryStage; className?: string }) {
  const { label, icon: Icon, className: tone } = STAGES[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium ring-1 ring-foreground/10 backdrop-blur",
        tone,
        className
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
