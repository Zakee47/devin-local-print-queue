"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Download,
  GripVertical,
  Inbox,
  ListOrdered,
  Pause,
  Printer,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDateTime } from "@/lib/datetime";
import { useSwatch } from "@/lib/use-swatch";
import { inServicePrinters, printersWithColour } from "@/lib/printers";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import SubmissionCard, { type BoardRow } from "@/components/admin/SubmissionCard";
import QueueFilters from "@/components/admin/QueueFilters";
import HistoryDialog from "@/components/admin/HistoryDialog";
import { useDownloadSubmission } from "@/components/admin/download";
import { errorMessage } from "@/lib/errors";
import { applyFilters, beforeIdAfterDrop, type FilterPill } from "@/components/admin/queue-view";

type Column = "all" | "review" | "queued" | "printing" | "done" | "rejected" | "withdrawn";
type PrinterOption = { name: string; label: string };
type PrinterChoices = { matching: PrinterOption[]; other: PrinterOption[] };

function columns(rows: BoardRow[]): Record<Column, BoardRow[]> {
  const byTime = (a: BoardRow, b: BoardRow) => a._creationTime - b._creationTime;
  const of = (status: BoardRow["status"]) => rows.filter((r) => r.status === status);
  const submitted = of("submitted");
  const withdrawn = submitted.filter((r) => r.participantNotice?.kind === "withdrawn");
  const votingApproved = submitted.filter((r) => !r.printRequested && r.votingApprovedAt !== undefined);
  return {
    all: [...rows].sort((a, b) => b._creationTime - a._creationTime),
    review: submitted.filter((r) => r.participantNotice?.kind !== "withdrawn" && r.votingApprovedAt === undefined).sort(
      (a, b) => Number(a.participantPrint !== null) - Number(b.participantPrint !== null) || byTime(a, b)
    ),
    queued: of("queued").sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0)),
    printing: of("printing").sort((a, b) => (a.printingAt ?? 0) - (b.printingAt ?? 0)),
    done: [...of("done"), ...votingApproved].sort((a, b) => (b.doneAt ?? b.votingApprovedAt ?? 0) - (a.doneAt ?? a.votingApprovedAt ?? 0)),
    rejected: of("rejected").sort((a, b) => (b.rejectedAt ?? 0) - (a.rejectedAt ?? 0)),
    withdrawn: withdrawn.sort((a, b) => (b.participantNotice?.at ?? 0) - (a.participantNotice?.at ?? 0)),
  };
}

const TABS: { value: Column; label: string; empty: string }[] = [
  { value: "all", label: "All", empty: "No submissions." },
  { value: "review", label: "Needs review", empty: "Nothing waiting for review." },
  { value: "queued", label: "Queued", empty: "Approve a submission to queue it." },
  { value: "printing", label: "Printing", empty: "Nothing on the printers." },
  { value: "done", label: "Done", empty: "No finished prints yet." },
  { value: "rejected", label: "Rejected", empty: "No rejected files." },
  { value: "withdrawn", label: "Withdrawn", empty: "No withdrawn print requests." },
];

type StageColumn = Exclude<Column, "all">;

const STAGE_ICONS: Record<StageColumn, LucideIcon> = {
  review: Inbox,
  queued: ListOrdered,
  printing: Printer,
  done: CircleCheck,
  rejected: CircleX,
  withdrawn: Undo2,
};

function SortableCard({ id, printCode, children }: {
  id: BoardRow["_id"];
  printCode: string;
  children: (handle: ReactNode, style: { ref: (node: HTMLLIElement | null) => void; style: CSSProperties }, dragging: boolean) => ReactNode;
}) {
  const sortable = useSortable({ id });
  const style = {
    ref: sortable.setNodeRef,
    style: {
      transform: CSS.Transform.toString(sortable.transform),
      transition: sortable.transition,
    },
  };
  return <>{children(
    <Button type="button" size="icon-xs" variant="ghost" aria-label={`Drag to reorder ${printCode}`} title="Drag to reorder" {...sortable.attributes} {...sortable.listeners}><GripVertical /></Button>,
    style,
    sortable.isDragging
  )}</>;
}

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
  const [expandedAllStages, setExpandedAllStages] = useState<Record<StageColumn, boolean>>({
    review: true,
    queued: true,
    printing: true,
    done: false,
    rejected: false,
    withdrawn: false,
  });
  const [siteHeaderHeight, setSiteHeaderHeight] = useState(0);
  const [filterPills, setFilterPills] = useState<FilterPill[]>([]);
  const [optimisticQueueIds, setOptimisticQueueIds] = useState<BoardRow["_id"][] | null>(null);
  const printerStripRef = useRef<HTMLDivElement>(null);
  const printerCardsRef = useRef<HTMLDivElement>(null);
  const [printerScroll, setPrinterScroll] = useState({ left: false, right: false });
  const moveTo = useMutation(api.queue.moveTo);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [selectedIds, setSelectedIds] = useState<BoardRow["_id"][]>([]);
  const [onePrinter, setOnePrinter] = useState("");
  const [spreadPrinters, setSpreadPrinters] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const updatePrinterScroll = useCallback(() => {
    const strip = printerStripRef.current;
    if (!strip) return;
    const maxScroll = strip.scrollWidth - strip.clientWidth;
    const left = strip.scrollLeft > 0;
    const right = strip.scrollLeft < maxScroll - 1;
    setPrinterScroll((current) =>
      current.left === left && current.right === right ? current : { left, right }
    );
  }, []);

  useEffect(() => {
    const strip = printerStripRef.current;
    const cards = printerCardsRef.current;
    if (!strip || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updatePrinterScroll);
    observer.observe(strip);
    if (cards) observer.observe(cards);
    updatePrinterScroll();
    return () => observer.disconnect();
  }, [settings?.printers.length, updatePrinterScroll]);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const measure = () => setSiteHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!rows) return;
    const queued = new Set(rows.filter((row) => row.status === "queued").map((row) => row._id));
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setOptimisticQueueIds(null);
        setSelectedIds((selected) => selected.filter((id) => queued.has(id)));
      }
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
  if (optimisticQueueIds) {
    const order = new Map(optimisticQueueIds.map((id, index) => [id, index]));
    fullColumns.queued.sort((a, b) => (order.get(a._id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b._id) ?? Number.MAX_SAFE_INTEGER));
  }
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
  const filteredRows = applyFilters(rows, filterPills);
  const filtered = columns(filteredRows);
  if (optimisticQueueIds) {
    const order = new Map(optimisticQueueIds.map((id, index) => [id, index]));
    filtered.queued.sort((a, b) => (order.get(a._id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b._id) ?? Number.MAX_SAFE_INTEGER));
  }
  const reviewCount = filtered.review.length;
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
  const hasFilters = filterPills.some((pill) => pill.values.length > 0);
  const allShownQueued = filtered.queued;

  function choicesFor(row: BoardRow): PrinterChoices {
    const matches = new Set(printersWithColour(printerSettings, row.colour));
    const optionFor = ({ name }: { name: string }): PrinterOption => {
      const load = printerLoads.get(name);
      const label = [
        name,
        `${load?.queued ?? 0} queued`,
        load?.printing ? `${load.printing} printing` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return { name, label };
    };
    return {
      matching: row.colour ? inService.filter(({ name }) => matches.has(name)).map(optionFor) : [],
      other: inService.filter(({ name }) => !matches.has(name)).map(optionFor),
    };
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

  function renderCards(cardRows: BoardRow[], options: { selectable?: boolean; sortable?: boolean } = {}) {
    return (
      <ul className="flex flex-col gap-3">
        {cardRows.map((row) => {
          const position = queuePosition.get(row._id);
          const makeCard = (dragHandle?: ReactNode, dragStyle?: { ref: (node: HTMLLIElement | null) => void; style: CSSProperties }, isDragging = false) => (
            <SubmissionCard
              key={row._id}
              row={row}
              position={row.status === "queued" ? position : undefined}
              queueOrder={fullQueue.map((queued) => queued._id)}
              isOwner={isOwner}
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
              settingsPrinters={printerSettings}
              dragHandle={dragHandle}
              dragStyle={dragStyle}
              isDragging={isDragging}
            />
          );
          return options.sortable
            ? <SortableCard key={row._id} id={row._id} printCode={row.printCode}>{(handle, style, dragging) => makeCard(handle, style, dragging)}</SortableCard>
            : makeCard();
        })}
      </ul>
    );
  }

  const activePrintersForSpread = inService.map((printer) => printer.name).filter((name) => spreadPrinters.includes(name));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const activeId = active.id as BoardRow["_id"];
    const overId = over.id as BoardRow["_id"];
    const fullIds = fullQueue.map((row) => row._id);
    const visibleIds = filtered.queued.map((row) => row._id);
    const beforeId = beforeIdAfterDrop(fullIds, visibleIds, activeId, overId);
    const next = fullIds.filter((id) => id !== activeId);
    const insertAt = beforeId ? next.indexOf(beforeId) : next.length;
    next.splice(Math.max(0, insertAt), 0, activeId);
    setOptimisticQueueIds(next);
    void moveTo({ id: activeId, ...(beforeId ? { beforeId } : {}) }).catch((error) => {
      setOptimisticQueueIds(null);
      toast.error(errorMessage(error, "Queue reorder failed"));
    });
  }

  function scrollPrinterStatus(direction: -1 | 1) {
    const strip = printerStripRef.current;
    if (!strip) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    strip.scrollBy({ left: direction * 400, behavior });
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        setActiveTab(value as Column | "deleted");
      }}
    >
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
      <div className="mt-3">
        <QueueFilters rows={rows} pills={filterPills} onChange={setFilterPills} colours={colourOptions} printers={printerOptions} pausedPrinters={printerSettings.filter((printer) => printer.outOfService).map((printer) => printer.name)} swatch={swatch} />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Printer load · whole queue, not filtered</p>
          <div className="hidden items-center gap-1 md:flex">
            <Button type="button" variant="outline" size="icon" aria-label="Scroll printers left" aria-controls="printer-status-strip" disabled={!printerScroll.left} onClick={() => scrollPrinterStatus(-1)}>
              <ChevronLeft />
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="Scroll printers right" aria-controls="printer-status-strip" disabled={!printerScroll.right} onClick={() => scrollPrinterStatus(1)}>
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="relative">
          <div
            id="printer-status-strip"
            ref={printerStripRef}
            onScroll={updatePrinterScroll}
            className="flex snap-x snap-mandatory gap-2 overflow-x-auto"
          >
          <div className="sticky left-0 z-10 w-[200px] shrink-0 snap-start rounded-lg border border-border bg-card p-2">
            <p className="text-sm font-medium">Not assigned</p>
            <p className="text-xs text-muted-foreground"><span className="font-mono text-base tabular-nums">{notAssignedQueued}</span> queued</p>
            <p className="text-xs text-muted-foreground">needs a printer</p>
            {hasFilters ? <p className="text-xs text-muted-foreground">{filtered.queued.filter((row) => !row.printer).length} match filters</p> : null}
          </div>
          <div ref={printerCardsRef} className="flex w-max shrink-0 gap-2">
            {printerSettings.map((printer) => {
              const load = printerLoads.get(printer.name)!;
              const queued = filtered.queued.filter((row) => row.printer === printer.name).length;
              const printing = filtered.printing.filter((row) => row.printer === printer.name).length;
              return <div key={printer.name} className={`w-[200px] shrink-0 snap-start rounded-lg border bg-card p-2 ${printer.outOfService ? "border-amber-300 dark:border-amber-900" : "border-border"}`}>
                <p className="flex items-center gap-1 text-sm font-medium">
                  <Printer className="size-3.5 text-muted-foreground" />
                  {printer.outOfService
                    ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><Pause className="size-3" />{printer.name} · paused</span>
                    : printer.name}
                </p>
                <p className="text-xs text-muted-foreground"><span className="font-mono text-base tabular-nums">{load.queued}</span> queued · <span className="font-mono text-base tabular-nums">{load.printing}</span> printing</p>
                {hasFilters ? <p className="text-xs text-muted-foreground">{queued + printing} match filters</p> : null}
                <div className={`mt-1 flex flex-wrap gap-1 ${printer.outOfService ? "opacity-50 grayscale" : ""}`}>{printer.colours.map((colour) => <i key={colour} title={colour} className="size-3 rounded-full border" style={{ backgroundColor: swatch(colour) }} />)}</div>
              </div>;
            })}
          </div>
          </div>
          {printerScroll.left ? <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[208px] z-20 w-8 bg-gradient-to-r from-card to-transparent" /> : null}
          {printerScroll.right ? <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-card to-transparent" /> : null}
        </div>
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
            {tab.value === "queued" ? (
              <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                <Button type="button" size="sm" variant="outline" disabled={allShownQueued.length === 0} onClick={() => setSelectedIds([...new Set([...selectedQueuedIds, ...allShownQueued.map((row) => row._id)])])}>Select all shown</Button>
              </div>
            ) : null}
            {tab.value !== "all" ? <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">{tab.label} {cardRows.length}</h2> : null}
            {tab.value === "withdrawn" ? <p className="mb-3 text-sm text-muted-foreground">Participant removed the print request. Returns to Needs review if they ask again; Restore reverses a mistake.</p> : null}
            {cardRows.length === 0 ? (
              <Empty className="border border-dashed border-border-strong py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                  <EmptyTitle>{tab.label}</EmptyTitle>
                  <EmptyDescription>{tab.empty}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : tab.value === "all" ? (
              <div className="flex flex-col gap-6">
                {TABS.filter((stage) => stage.value !== "all").map((stage) => {
                  const stageRows = filtered[stage.value];
                  const stageValue = stage.value as StageColumn;
                  const expanded = expandedAllStages[stageValue];
                  const canToggle = stageRows.length > 0;
                  const StageIcon = STAGE_ICONS[stageValue];
                  const panelId = `all-stage-${stageValue}`;
                  return (
                    <section key={stage.value} className="flex flex-col gap-2">
                      <button
                        type="button"
                        className="sticky z-30 flex w-full items-center gap-2 border-b border-border bg-background py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default"
                        style={{ top: siteHeaderHeight }}
                        aria-expanded={canToggle && expanded}
                        aria-controls={panelId}
                        disabled={!canToggle}
                        onClick={() => setExpandedAllStages((current) => ({ ...current, [stageValue]: !current[stageValue] }))}
                      >
                        <StageIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-foreground">{stage.label}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] leading-4 text-muted-foreground">{stageRows.length}</span>
                        {canToggle ? expanded ? (
                          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        ) : null}
                      </button>
                      {stage.value === "withdrawn" ? <p className="text-sm text-muted-foreground">Participant removed the print request. Returns to Needs review if they ask again; Restore reverses a mistake.</p> : null}
                      <div id={panelId} hidden={!canToggle || !expanded} className={canToggle && expanded ? "pt-2" : undefined}>
                        {canToggle && expanded ? renderCards(stageRows) : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <>
                {tab.value === "queued" ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={cardRows.map((row) => row._id)} strategy={verticalListSortingStrategy}>
                      {renderCards(cardRows, { selectable: true, sortable: true })}
                    </SortableContext>
                  </DndContext>
                ) : renderCards(cardRows)}
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
