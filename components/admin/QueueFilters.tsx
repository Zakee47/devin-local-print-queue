"use client";

import { useState } from "react";
import { ChevronDown, Pause, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ANY_COLOUR, NOT_ASSIGNED, optionCounts, type FilterPill, type QueueViewRow } from "@/components/admin/queue-view";

export default function QueueFilters({
  rows, pills, onChange, colours, printers, pausedPrinters = [], swatch,
}: {
  rows: QueueViewRow[];
  pills: FilterPill[];
  onChange: (pills: FilterPill[]) => void;
  colours: string[];
  printers: string[];
  pausedPrinters?: string[];
  swatch: (colour: string) => string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [openPillId, setOpenPillId] = useState<number | null>(null);
  const availableDimensions = (["colour", "printer"] as const).filter(
    (dimension) => !pills.some((pill) => pill.dimension === dimension)
  );

  function toggle(pill: FilterPill, value: string) {
    onChange(pills.map((item) => item.id !== pill.id ? item : {
      ...item,
      values: item.values.includes(value) ? item.values.filter((v) => v !== value) : [...item.values, value],
    }));
  }

  function add(dimension: FilterPill["dimension"]) {
    const id = Math.max(0, ...pills.map((pill) => pill.id)) + 1;
    onChange([...pills, { id, dimension, values: [] }]);
    setAddOpen(false);
    setOpenPillId(id);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger render={<Button type="button" size="sm" variant="outline" disabled={!availableDimensions.length} />}>
          + Add filter
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-2">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Filter by</p>
          {availableDimensions.map((dimension) => (
            <Button key={dimension} type="button" variant="ghost" className="w-full justify-start" onClick={() => add(dimension)}>
              {dimension === "colour" ? "Colour" : "Printer"}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
      {pills.map((pill, index) => {
        const options = pill.dimension === "colour" ? [ANY_COLOUR, ...colours] : [NOT_ASSIGNED, ...printers];
        const counts = optionCounts(rows, pills, index, pill.dimension, options);
        const label = pill.dimension === "colour" ? "Colour" : "Printer";
        const selection = pill.values.map((value) => value === ANY_COLOUR
          ? "any"
          : value === NOT_ASSIGNED
            ? "not assigned"
            : value
        ).join(", ");
        return (
          <div key={pill.id} className="inline-flex h-[30px] items-center overflow-hidden rounded-full bg-foreground text-[13px] text-background">
            <span className="ml-1.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-background font-mono text-[11px] leading-none text-foreground">{index + 1}</span>
            <Popover open={openPillId === pill.id} onOpenChange={(open) => setOpenPillId(open ? pill.id : null)}>
              <PopoverTrigger render={<button type="button" className="inline-flex h-full min-w-0 items-center gap-1.5 whitespace-nowrap px-2 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-background/70 focus-visible:ring-inset" />}>
                <span className="text-background/70">{label} is</span>
                <span>{selection || "choose…"}</span>
                <ChevronDown className="size-3 shrink-0 text-background/70" />
              </PopoverTrigger>
              <PopoverContent align="start" className="max-h-80 w-64 overflow-y-auto p-2">
                <div className="flex flex-col gap-1">
                  {options.map((value) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                      <Checkbox checked={pill.values.includes(value)} onCheckedChange={() => toggle(pill, value)} />
                      {pill.dimension === "colour" && value !== ANY_COLOUR ? <i className="size-3 rounded-full border" style={{ backgroundColor: swatch(value) }} /> : null}
                      {pill.dimension === "printer" && pausedPrinters.includes(value) ? <Pause className="size-3 text-amber-700 dark:text-amber-300" /> : null}
                      <span className={`min-w-0 flex-1 ${pill.dimension === "printer" && pausedPrinters.includes(value) ? "text-amber-800 dark:text-amber-200" : ""}`}>{value === ANY_COLOUR ? "Any colour" : value === NOT_ASSIGNED ? "Not assigned" : `${value}${pill.dimension === "printer" && pausedPrinters.includes(value) ? " · paused" : ""}`}</span>
                      <span className="font-mono text-xs text-muted-foreground">{counts[value] ?? 0}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <button type="button" className="inline-flex h-full w-7 shrink-0 items-center justify-center border-l border-background/20 text-background outline-none transition-colors hover:bg-background/10 focus-visible:ring-2 focus-visible:ring-background/70 focus-visible:ring-inset" aria-label={`Remove ${label.toLowerCase()} filter ${index + 1}`} onClick={() => {
              if (openPillId === pill.id) setOpenPillId(null);
              onChange(pills.filter((item) => item.id !== pill.id));
            }}><X className="size-3.5" /></button>
          </div>
        );
      })}
      {pills.length ? <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>Clear all</Button> : null}
    </div>
  );
}
