import { swatchFor } from "@/lib/colours";
import { cn } from "@/lib/utils";

export default function Swatch({ colour, className }: { colour: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-4 shrink-0 rounded-full ring-1 ring-foreground/15", className)}
      style={{ backgroundColor: swatchFor(colour ?? undefined) }}
    />
  );
}
