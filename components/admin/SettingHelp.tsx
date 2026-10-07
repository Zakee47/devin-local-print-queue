"use client";

import { CircleHelp } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SettingHelpCopy } from "@/lib/settings-help";
import { cn } from "@/lib/utils";

// "?" button that explains a setting. Click, tap or Enter opens it; Escape or
// clicking outside closes it.
export default function SettingHelp({
  title,
  what,
  on,
  off,
  note,
  className,
}: SettingHelpCopy & { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`What does ${title} do?`}
        className={cn(
          "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full align-middle text-muted-foreground transition-colors hover:text-foreground outline-none focus-visible:bg-muted focus-visible:text-foreground data-popup-open:text-foreground",
          className
        )}
      >
        <CircleHelp aria-hidden className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] gap-2 p-3 text-left leading-relaxed"
      >
        <PopoverTitle>{title}</PopoverTitle>
        <PopoverDescription>{what}</PopoverDescription>
        <dl className="flex flex-col gap-1.5">
          {[on, off].map((state) => (
            <div key={state.label}>
              <dt className="inline font-medium">{state.label}</dt>{" "}
              <dd className="inline text-muted-foreground">{state.text}</dd>
            </div>
          ))}
        </dl>
        {note ? (
          <p className="border-t border-border pt-2 text-xs text-muted-foreground">{note}</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
