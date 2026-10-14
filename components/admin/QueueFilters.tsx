"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronDown, Pause, Printer, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import Highlight from "@/components/admin/Highlight";
import {
  ANY_COLOUR, NOT_ASSIGNED, matchesSearch, optionCounts, searchSuggestions,
  type FilterPill, type QueueViewRow, type SearchableRow, type SearchSuggestion,
} from "@/components/admin/queue-view";
import { cn } from "@/lib/utils";

export default function QueueFilters({
  rows, pills, onChange, colours, printers, pausedPrinters = [], swatch,
  query, onQueryChange, suggestionRows,
}: {
  rows: QueueViewRow[];
  pills: FilterPill[];
  onChange: (pills: FilterPill[]) => void;
  colours: string[];
  printers: string[];
  pausedPrinters?: string[];
  swatch: (colour: string) => string;
  query: string;
  onQueryChange: (q: string) => void;
  suggestionRows: QueueViewRow[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [openPillId, setOpenPillId] = useState<number | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const availableDimensions = (["colour", "printer"] as const).filter(
    (dimension) => !pills.some((pill) => pill.dimension === dimension)
  );
  const suggestions = searchSuggestions(suggestionRows, query, pills, colours, printers);
  const matchesInTab = suggestionRows.filter((row) => matchesSearch(row as SearchableRow, query)).length;
  const isSuggestionsOpen = suggestionsOpen && Boolean(query.trim());
  const activeIndex = Math.min(activeOptionIndex, suggestions.length);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !searchRef.current?.contains(event.target)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

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

  function closeSuggestions() {
    setSuggestionsOpen(false);
  }

  function chooseSuggestion(suggestion: SearchSuggestion) {
    const existing = pills.find((pill) => pill.dimension === suggestion.dimension);
    if (existing) {
      onChange(pills.map((pill) => pill.id !== existing.id ? pill : {
        ...pill,
        values: [...pill.values, suggestion.value],
      }));
    } else {
      const id = Math.max(0, ...pills.map((pill) => pill.id)) + 1;
      onChange([...pills, { id, dimension: suggestion.dimension, values: [suggestion.value] }]);
    }
    onQueryChange("");
    setSuggestionsOpen(false);
    setActiveOptionIndex(0);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (!query.trim()) return;
      event.preventDefault();
      if (!isSuggestionsOpen) {
        setSuggestionsOpen(true);
        setActiveOptionIndex(0);
      } else {
        setActiveOptionIndex((index) => Math.min(index + 1, suggestions.length));
      }
    } else if (event.key === "ArrowUp") {
      if (!query.trim()) return;
      event.preventDefault();
      if (!isSuggestionsOpen) {
        setSuggestionsOpen(true);
        setActiveOptionIndex(0);
      } else {
        setActiveOptionIndex((index) => Math.max(index - 1, 0));
      }
    } else if (event.key === "Enter" && isSuggestionsOpen) {
      event.preventDefault();
      const suggestion = suggestions[activeIndex];
      if (suggestion) chooseSuggestion(suggestion);
      else closeSuggestions();
    } else if (event.key === "Escape" && isSuggestionsOpen) {
      event.preventDefault();
      closeSuggestions();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={searchRef} className="relative w-full min-w-0 md:w-auto md:min-w-64 md:flex-1">
        <InputGroup>
          <InputGroupAddon align="inline-start"><Search aria-hidden="true" /></InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search or filter the queue"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={isSuggestionsOpen}
            aria-controls={isSuggestionsOpen ? listboxId : undefined}
            aria-activedescendant={isSuggestionsOpen ? `${listboxId}-option-${activeIndex}` : undefined}
            placeholder="Search or filter: gold, muon, KC-025, a name…"
            value={query}
            onFocus={() => {
              if (query.trim()) {
                setSuggestionsOpen(true);
                setActiveOptionIndex(0);
              }
            }}
            onChange={(event) => {
              const nextQuery = event.currentTarget.value;
              onQueryChange(nextQuery);
              setSuggestionsOpen(Boolean(nextQuery.trim()));
              setActiveOptionIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          {query ? (
            <InputGroupAddon align="inline-end" className="pr-1">
              <InputGroupButton
                aria-label="Clear search"
                title="Clear search"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onQueryChange("");
                  closeSuggestions();
                  inputRef.current?.focus();
                }}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        {isSuggestionsOpen ? (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Queue search suggestions"
            className="absolute left-0 top-full z-50 mt-1 flex w-full min-w-[min(32rem,calc(100vw-2rem))] flex-col gap-1 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            {suggestions.length ? (
              <>
                <div role="group" aria-labelledby={`${listboxId}-quick-filters`}>
                  <p id={`${listboxId}-quick-filters`} className="px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Quick filters</p>
                  {suggestions.map((suggestion, index) => {
                    const label = suggestion.value === ANY_COLOUR
                      ? "Any colour"
                      : suggestion.value === NOT_ASSIGNED
                        ? "Not assigned"
                        : suggestion.value;
                    const paused = suggestion.dimension === "printer" &&
                      pausedPrinters.some((printer) => printer.toLowerCase() === suggestion.value.toLowerCase());
                    return (
                      <Button
                        key={`${suggestion.dimension}:${suggestion.value}`}
                        id={`${listboxId}-option-${index}`}
                        type="button"
                        variant="ghost"
                        role="option"
                        aria-selected={activeIndex === index}
                        className={cn(
                          "w-full justify-start gap-2 px-2 text-left font-normal",
                          activeIndex === index && "bg-muted text-foreground"
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveOptionIndex(index)}
                        onClick={() => chooseSuggestion(suggestion)}
                      >
                        {suggestion.dimension === "colour" ? (
                          <i
                            aria-hidden="true"
                            className="size-3 shrink-0 rounded-full border border-black/10"
                            style={suggestion.value === ANY_COLOUR
                              ? { backgroundImage: "conic-gradient(#e11d48 0deg 90deg, #eab308 90deg 180deg, #16a34a 180deg 270deg, #3b82f6 270deg 360deg)" }
                              : { backgroundColor: swatch(suggestion.value) }}
                          />
                        ) : paused ? (
                          <Pause data-icon="inline-start" aria-hidden="true" className="text-amber-700 dark:text-amber-300" />
                        ) : (
                          <Printer data-icon="inline-start" aria-hidden="true" />
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground">{suggestion.dimension === "colour" ? "Colour:" : "Printer:"}</span>
                        <span className={cn("min-w-0 truncate", paused && "text-amber-800 dark:text-amber-200")}>
                          <Highlight text={label} query={query} />
                        </span>
                        {paused ? <span className="shrink-0 text-xs text-amber-800 dark:text-amber-200">· paused</span> : null}
                        <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{suggestion.count}</span>
                      </Button>
                    );
                  })}
                </div>
                <Separator className="my-1" />
              </>
            ) : null}
            <Button
              id={`${listboxId}-option-${suggestions.length}`}
              type="button"
              variant="ghost"
              role="option"
              aria-selected={activeIndex === suggestions.length}
              className={cn(
                "w-full justify-start gap-2 px-2 text-left font-normal whitespace-normal",
                activeIndex === suggestions.length && "bg-muted text-foreground"
              )}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveOptionIndex(suggestions.length)}
              onClick={closeSuggestions}
            >
              <Search data-icon="inline-start" aria-hidden="true" />
              <span className="min-w-0 flex-1">Search “{query}” in codes, names, keychains, files and notes</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{matchesInTab}</span>
            </Button>
          </div>
        ) : null}
      </div>
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
      {pills.length || query ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange([]);
            onQueryChange("");
            closeSuggestions();
          }}
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}
