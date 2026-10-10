"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Inbox, Pause } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDateTime } from "@/lib/datetime";
import { useSwatch } from "@/lib/use-swatch";
import { inServicePrinters, printersWithColour } from "@/lib/printers";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import SubmissionCard, { type BoardRow } from "@/components/admin/SubmissionCard";
import HistoryDialog from "@/components/admin/HistoryDialog";
import { useDownloadSubmission } from "@/components/admin/download";
import { errorMessage } from "@/lib/errors";

type Column = "all" | "review" | "queued" | "printing" | "done" | "rejected";
type PrinterOption = { name: string; label: string };

const ANY_COLOUR = "__any_colour__";
const NOT_ASSIGNED = "__not_assigned__";
const SHOW_ALL_PRINTERS_KEY = "admin.showAllPrinters";
const SHOW_ALL_PRINTERS_EVENT = "admin-show-all-printers-change";

function subscribeToShowAllPrinters(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SHOW_ALL_PRINTERS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SHOW_ALL_PRINTERS_EVENT, onChange);
  };
}

function getShowAllPrintersSnapshot() {
  return window.localStorage.getItem(SHOW_ALL_PRINTERS_KEY) === "true";
}

function getServerShowAllPrintersSnapshot() {
  return false;
}

function saveShowAllPrinters(value: boolean) {
  window.localStorage.setItem(SHOW_ALL_PRINTERS_KEY, String(value));
  window.dispatchEvent(new Event(SHOW_ALL_PRINTERS_EVENT));
}

function columns(rows: BoardRow[]): Record<Column, BoardRow[]> {
  const byTime = (a: BoardRow, b: BoardRow) => a._creationTime - b._creationTime;
  const of = (status: BoardRow["status"]) => rows.filter((r) => r.status === status);
  return {
    all: [...rows].sort((a, b) => b._creationTime - a._creationTime),
    review: of("submitted").sort(
      (a, b) => Number(a.participantPrint !== null) - Number(b.participantPrint !== null) || byTime(a, b)
    ),
    queued: of("queued").sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0)),
    printing: of("printing").sort((a, b) => (a.printingAt ?? 0) - (b.printingAt ?? 0)),
    done: of("done").sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    rejected: of("rejected").sort((a, b) => (b.rejectedAt ?? 0) - (a.rejectedAt ?? 0)),
  };
}

function printingGroups(rows: BoardRow[], printerOrder: string[]) {
  const byPrinter = new Map<string, BoardRow[]>();
  const withoutPrinter: BoardRow[] = [];
  for (const row of rows) {
    if (!row.printer) {
      withoutPrinter.push(row);
      continue;
    }
    const group = byPrinter.get(row.printer) ?? [];
    group.push(row);
    byPrinter.set(row.printer, group);
  }
  const groups: { printer: string | null; rows: BoardRow[] }[] = printerOrder.flatMap((printer) => {
    const group = byPrinter.get(printer);
    return group ? [{ printer, rows: group }] : [];
  });
  const configured = new Set(printerOrder);
  for (const [printer, group] of byPrinter) {
    if (!configured.has(printer)) groups.push({ printer, rows: group });
  }
  if (withoutPrinter.length > 0) groups.push({ printer: null, rows: withoutPrinter });
  return groups;
}

const TABS: { value: Column; label: string; empty: string }[] = [
  { value: "all", label: "All", empty: "No submissions." },
  { value: "review", label: "Needs review", empty: "Nothing waiting for review." },
  { value: "queued", label: "Queued", empty: "Approve a submission to queue it." },
  { value: "printing", label: "Printing", empty: "Nothing on the printers." },
  { value: "done", label: "Done", empty: "No finished prints yet." },
  { value: "rejected", label: "Rejected", empty: "No rejected files." },
];

export default function QueueBoard() {
  const rows = useQuery(api.queue.board);
  const settings = useQuery(api.settings.get);
  const role = useQuery(api.admins.role);
  const withdrawals = useQuery(api.queue.recentWithdrawals);
  const isOwner = role === "owner";
  const deleted = useQuery(api.history.deletedSubmissions, isOwner ? {} : "skip");
  const restoreSubmission = useMutation(api.history.restoreSubmission);
  const assignPrinters = useMutation(api.queue.assignPrinters);
  const download = useDownloadSubmission();
  const swatch = useSwatch();
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<Column | "deleted">("review");
  const [colourFilters, setColourFilters] = useState<string[]>([]);
  const [printerFilters, setPrinterFilters] = useState<string[]>([]);
  const showAllPrinters = useSyncExternalStore(
    subscribeToShowAllPrinters,
    getShowAllPrintersSnapshot,
    getServerShowAllPrintersSnapshot
  );
  const [selectedIds, setSelectedIds] = useState<BoardRow["_id"][]>([]);
  const [onePrinter, setOnePrinter] = useState("");
  const [spreadPrinters, setSpreadPrinters] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (!rows) return;
    const queued = new Set(rows.filter((row) => row.status === "queued").map((row) => row._id));
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSelectedIds((selected) => selected.filter((id) => queued.has(id)));
    });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  if (rows === undefined || settings === undefined || role === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-96 rounded-lg" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    );
  }

  const fullColumns = columns(rows);
  const fullQueue = fullColumns.queued;
  const queuePosition = new Map(fullQueue.map((row, index) => [row._id, index + 1]));
  const queuedIds = new Set(fullQueue.map((row) => row._id));
  const selectedQueuedIds = selectedIds.filter((id) => queuedIds.has(id));
  const selectedVisible = selectedQueuedIds.length;
  const palette = [...settings.colours];
  const printerSettings = settings.printers;
  const otherColours = rows.flatMap((row) => (row.colour ? [row.colour] : []));
  const colourOptions = [...palette, ...otherColours].filter(
    (colour, index, all) =>
      all.findIndex((candidate) => candidate.toLowerCase() === colour.toLowerCase()) === index
  );
  const configuredPrinters = printerSettings.map((printer) => printer.name);
  const otherPrinters = rows.flatMap((row) => (row.printer ? [row.printer] : []));
  const printerOptions = [...configuredPrinters, ...otherPrinters].filter(
    (printer, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === printer.toLowerCase()) === index
  );
  const filteredRows = rows.filter((row) => {
    const colourMatches =
      colourFilters.length === 0 ||
      (row.colour
        ? colourFilters.some((colour) => colour !== ANY_COLOUR && colour.toLowerCase() === row.colour!.toLowerCase())
        : colourFilters.includes(ANY_COLOUR));
    const printerMatches =
      printerFilters.length === 0 ||
      (row.printer
        ? printerFilters.some((printer) => printer !== NOT_ASSIGNED && printer.toLowerCase() === row.printer!.toLowerCase())
        : printerFilters.includes(NOT_ASSIGNED));
    return colourMatches && printerMatches;
  });
  const filtered = columns(filteredRows);
  const reviewCount = filtered.review.filter((row) => row.participantPrint === null).length;
  const printerGroups = printingGroups(filtered.printing, configuredPrinters);
  const inService = inServicePrinters(printerSettings);
  const printerLoads = new Map(
    printerSettings.map(({ name }) => [
      name,
      {
        queued: rows.filter((row) => row.status === "queued" && row.printer === name).length,
        printing: rows.filter((row) => row.status === "printing" && row.printer === name).length,
      },
    ])
  );
  const notAssignedQueued = rows.filter((row) => row.status === "queued" && !row.printer).length;
  const hasFilters = colourFilters.length > 0 || printerFilters.length > 0;
  const allShownQueued = filtered.queued;

  function toggleFilter(current: string[], value: string, set: (next: string[]) => void) {
    set(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function choicesFor(row: BoardRow): PrinterOption[] {
    const matches = new Set(printersWithColour(printerSettings, row.colour));
    const options =
      showAllPrinters || (row.colour && matches.size === 0)
        ? inService
        : inService.filter(({ name }) => matches.has(name));
    return options.map(({ name }) => {
      const loaded =
        row.colour != null &&
        printerSettings
          .find((printer) => printer.name === name)
          ?.colours.some((colour) => colour.toLowerCase() === row.colour!.toLowerCase());
      const load = printerLoads.get(name);
      const label = [
        name,
        row.colour && loaded ? `${row.colour} loaded` : "",
        `${load?.queued ?? 0} queued`,
        load?.printing ? `${load.printing} printing` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return { name, label };
    });
  }

  async function downloadAllQueued() {
    setDownloading(true);
    try {
      for (const row of filtered.queued) {
        await download(row._id, row.downloadName);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      toast.success(`Downloaded ${filtered.queued.length} files`);
    } catch (err) {
      toast.error(errorMessage(err, "Download failed"));
    } finally {
      setDownloading(false);
    }
  }

  async function bulkAssign(mode: "one" | "spread", printerNames: string[]) {
    if (!selectedQueuedIds.length || !printerNames.length) return;
    setBulkBusy(true);
    try {
      const result = await assignPrinters({ ids: selectedQueuedIds, printers: printerNames, mode });
      const skippedCodes = result.skipped.map((row) => row.printCode);
      const skipped = skippedCodes.length
        ? ` · skipped ${skippedCodes.length} (${skippedCodes.join(", ")}: colour not loaded on chosen printers)`
        : "";
      toast.success(`Assigned ${result.assigned.length}${skipped}`);
      setSelectedIds([]);
    } catch (err) {
      toast.error(errorMessage(err, "Bulk assignment failed"));
    } finally {
      setBulkBusy(false);
    }
  }

  function tabCount(tab: Column) {
    if (tab === "all") return filteredRows.length;
    if (tab === "review") return reviewCount;
    return filtered[tab].length;
  }

  function renderCards(cardRows: BoardRow[], options: { status?: boolean; selectable?: boolean } = {}) {
    return (
      <ul className="flex flex-col gap-3">
        {cardRows.map((row) => {
          const position = queuePosition.get(row._id);
          const queueIndex = position === undefined ? undefined : position - 1;
          return (
            <SubmissionCard
              key={row._id}
              row={row}
              position={row.status === "queued" ? position : undefined}
              isFirst={queueIndex === 0}
              isLast={queueIndex !== undefined && queueIndex === fullQueue.length - 1}
              isOwner={isOwner}
              showStatusBadge={options.status}
              showSelection={options.selectable}
              selected={selectedQueuedIds.includes(row._id)}
              onSelectionChange={(checked) => {
                setSelectedIds((selected) => {
                  const current = selected.filter((id) => queuedIds.has(id));
                  return checked
                    ? current.includes(row._id)
                      ? current
                      : [...current, row._id]
                    : current.filter((id) => id !== row._id);
                });
              }}
              printerOptions={choicesFor(row)}
            />
          );
        })}
      </ul>
    );
  }

  const activePrintersForSpread = inService.map((printer) => printer.name).filter((name) => spreadPrinters.includes(name));

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        setActiveTab(value as Column | "deleted");
      }}
    >
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium">Filter submissions</span>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-all-printers"
              checked={showAllPrinters}
              onCheckedChange={(checked) => saveShowAllPrinters(checked === true)}
            />
            <label htmlFor="show-all-printers" className="text-sm">Show all printers</label>
            {hasFilters ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setColourFilters([]);
                  setPrinterFilters([]);
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Colour</span>
          <ToggleGroup multiple value={colourFilters} onValueChange={setColourFilters} className="flex flex-wrap justify-start">
            <ToggleGroupItem value={ANY_COLOUR} aria-label="Any colour" className="h-8 px-2 text-xs">
              Any colour
            </ToggleGroupItem>
            {colourOptions.map((colour) => (
              <ToggleGroupItem key={colour.toLowerCase()} value={colour} aria-label={colour} className="h-8 gap-1.5 px-2 text-xs">
                <span aria-hidden className="size-3 rounded-full ring-1 ring-foreground/20" style={{ backgroundColor: swatch(colour) }} />
                {colour}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Printer</span>
          <ToggleGroup multiple value={printerFilters} onValueChange={setPrinterFilters} className="flex flex-wrap justify-start">
            <ToggleGroupItem value={NOT_ASSIGNED} aria-label="Not assigned" className="h-8 px-2 text-xs">
              Not assigned
            </ToggleGroupItem>
            {printerOptions.map((name) => {
              const printer = printerSettings.find((item) => item.name.toLowerCase() === name.toLowerCase());
              return (
                <ToggleGroupItem
                  key={name.toLowerCase()}
                  value={name}
                  aria-label={printer?.outOfService ? `${name} · paused` : name}
                  className={`h-8 gap-1.5 px-2 text-xs${printer?.outOfService ? " border-dashed opacity-60" : ""}`}
                >
                  {printer?.outOfService ? (
                    <>
                      <Pause aria-hidden className="size-3" />
                      {name}
                      <span>· paused</span>
                    </>
                  ) : (
                    name
                  )}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Printer load · unfiltered queue</span>
          <div className="flex flex-wrap gap-2">
            {printerSettings.map((printer) => {
              const load = printerLoads.get(printer.name)!;
              const isSelected = printerFilters.includes(printer.name);
              return (
                <Button
                  key={printer.name}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className={
                    printer.outOfService
                      ? isSelected
                        ? "border-dashed"
                        : "border-dashed bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                      : undefined
                  }
                  onClick={() => toggleFilter(printerFilters, printer.name, setPrinterFilters)}
                >
                  {printer.outOfService ? (
                    <>
                      <Pause aria-hidden className="size-3" />
                      {printer.name}
                      <span>· paused</span>
                    </>
                  ) : (
                    printer.name
                  )}
                  {" · "}
                  {load.queued} queued · {load.printing} printing
                </Button>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant={printerFilters.includes(NOT_ASSIGNED) ? "default" : "outline"}
              onClick={() => toggleFilter(printerFilters, NOT_ASSIGNED, setPrinterFilters)}
            >
              Not assigned · {notAssignedQueued} queued
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="flex-wrap group-data-horizontal/tabs:h-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="px-2.5">
              {tab.label}
              <span className="font-mono text-xs text-muted-dim tabular-nums">{tabCount(tab.value)}</span>
            </TabsTrigger>
          ))}
          {isOwner ? (
            <TabsTrigger value="deleted" className="px-2.5">
              Deleted
              <span className="font-mono text-xs text-muted-dim tabular-nums">{deleted?.length ?? "…"}</span>
            </TabsTrigger>
          ) : null}
        </TabsList>
        <Button
          variant="outline"
          size="sm"
          disabled={downloading || filtered.queued.length === 0}
          onClick={downloadAllQueued}
        >
          <Download data-icon="inline-start" />
          {downloading ? "Downloading..." : `Download all queued (${filtered.queued.length})`}
        </Button>
      </div>

      {withdrawals?.length ? (
        <Alert className="mt-4">
          <AlertTitle>Changed by participants</AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {withdrawals.map((row) => (
                <li key={row._id}>
                  <span className="font-mono">{row.printCode}</span> {row.title} · {row.participantUsername} · {row.detail} · {formatDateTime(row.at)}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {TABS.map((tab) => {
        const cardRows = filtered[tab.value];
        return (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {cardRows.length === 0 ? (
              <Empty className="border border-dashed border-border-strong py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                  <EmptyTitle>{tab.label}</EmptyTitle>
                  <EmptyDescription>{tab.empty}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : tab.value === "printing" ? (
              <div className="flex flex-col gap-4">
                {printerGroups.map(({ printer, rows: groupRows }) => (
                  <section key={printer ?? "no-printer"} className="flex flex-col gap-2">
                    <h3 className="font-mono text-sm text-muted-foreground">
                      {printer ?? "No printer set"} · {groupRows.length} {groupRows.length === 1 ? "job" : "jobs"}
                    </h3>
                    {renderCards(groupRows)}
                  </section>
                ))}
              </div>
            ) : tab.value === "all" ? (
              renderCards(cardRows, { status: true })
            ) : (
              <>
                {tab.value === "queued" ? (
                  <div className="mb-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={allShownQueued.length === 0}
                      onClick={() =>
                        setSelectedIds([
                          ...new Set([...selectedQueuedIds, ...allShownQueued.map((row) => row._id)]),
                        ])
                      }
                    >
                      Select all shown
                    </Button>
                  </div>
                ) : null}
                {renderCards(cardRows, { selectable: tab.value === "queued" })}
                {tab.value === "queued" && selectedVisible > 0 ? (
                  <div className="sticky bottom-3 z-20 mt-4 flex flex-col gap-3 rounded-xl border border-brand/50 bg-background/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <strong>{selectedVisible} selected</strong>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds([...new Set([...selectedQueuedIds, ...allShownQueued.map((row) => row._id)])])}>
                        Select all shown
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear</Button>
                    </div>
                    <div className="flex flex-col gap-3 sm:items-end">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">Assign to one printer</span>
                        <NativeSelect aria-label="Assign selected to one printer" size="sm" value={onePrinter} onChange={(event) => setOnePrinter(event.currentTarget.value)}>
                          <option value="">Choose printer</option>
                          {inService.map(({ name }) => <option key={name} value={name}>{name}</option>)}
                        </NativeSelect>
                        <Button type="button" size="sm" disabled={bulkBusy || !onePrinter} onClick={() => void bulkAssign("one", [onePrinter])}>Assign</Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">Spread evenly</span>
                        <ToggleGroup multiple value={spreadPrinters} onValueChange={setSpreadPrinters} className="flex flex-wrap justify-start">
                          {inService.map(({ name }) => (
                            <ToggleGroupItem key={name} value={name} aria-label={name} className="h-8 px-2 text-xs">{name}</ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                        <Button type="button" size="sm" disabled={bulkBusy || activePrintersForSpread.length === 0} onClick={() => void bulkAssign("spread", activePrintersForSpread)}>Spread</Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </TabsContent>
        );
      })}
      {isOwner ? (
        <TabsContent value="deleted" className="mt-4">
          {deleted === undefined ? (
            <Skeleton className="h-36 rounded-xl" />
          ) : deleted.length === 0 ? (
            <Empty className="border border-dashed border-border-strong py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                <EmptyTitle>Deleted submissions</EmptyTitle>
                <EmptyDescription>No deleted submissions.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {deleted.map((row) => (
                <li key={row._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-lg">{row.printCode}</p>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.participantUsername} · {new Date(row.deletedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Roles before deletion: {[
                        row.deletedRoles.vote ? "Vote" : "",
                        row.deletedRoles.print ? "Print" : "",
                      ].filter(Boolean).join(" + ") || "None"}
                    </p>
                  </div>
                  <HistoryDialog submissionId={row._id} deleted restore={row.restore} />
                  <Button
                    type="button"
                    size="sm"
                    variant="brand"
                    disabled={!row.restore.ok}
                    title={!row.restore.ok ? row.restore.reason : undefined}
                    onClick={() => {
                      void restoreSubmission({ id: row._id })
                        .then(() => toast.success(`${row.printCode} restored`))
                        .catch((error) => toast.error(error instanceof Error ? error.message : "Couldn't restore submission"));
                    }}
                  >
                    Restore submission
                  </Button>
                  {!row.restore.ok ? <p className="w-full text-right text-xs text-muted-foreground">{row.restore.reason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
