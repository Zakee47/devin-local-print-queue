"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Box, Check, ChevronDown, Download, Ellipsis, Eye, History, Image as ImageIcon,
  Minus, Pause, Play, Plus, Printer, RotateCcw, Trophy, Undo2, X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSwatch } from "@/lib/use-swatch";
import { formatDateTime } from "@/lib/datetime";
import { formatDimensions } from "@/lib/dimensions";
import { useNow } from "@/components/admin/use-now";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import RejectDialog from "@/components/admin/RejectDialog";
import { useDownloadSubmission } from "@/components/admin/download";
import HistoryDialog from "@/components/admin/HistoryDialog";
import { errorMessage } from "@/lib/errors";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";

export type BoardRow = FunctionReturnType<typeof api.queue.board>[number];

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), { ssr: false });
type PrinterGroups = { matching: { name: string; label: string }[]; other: { name: string; label: string }[] };
type DragStyle = { ref?: (node: HTMLLIElement | null) => void; style?: CSSProperties };
type PrinterSetting = { name: string; outOfService?: boolean };
type BadgeTone = "outline" | "filled" | "red";

function CardBadge({ children, tone = "outline" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full border px-[7px] text-[11.5px] leading-none whitespace-nowrap",
        tone === "filled" && "border-foreground bg-foreground text-background",
        tone === "outline" && "border-border bg-card text-foreground",
        tone === "red" && "border-destructive/40 bg-destructive/5 text-destructive"
      )}
    >
      {children}
    </span>
  );
}

function PrinterSelect({
  row, value, disabled, onChange, options, settingsPrinters, paused,
}: {
  row: BoardRow; value: string; disabled?: boolean;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options: PrinterGroups;
  settingsPrinters: PrinterSetting[];
  paused: boolean;
}) {
  const printerName = row.printer?.trim().toLowerCase();
  const allOptions = [...options.matching, ...options.other];
  const currentOption = printerName
    ? allOptions.find((printer) => printer.name.trim().toLowerCase() === printerName)
    : undefined;
  const configuredPrinter = printerName
    ? settingsPrinters.find((printer) => printer.name.trim().toLowerCase() === printerName)
    : undefined;
  const currentValue = currentOption?.name ?? configuredPrinter?.name ?? value;
  return (
    <NativeSelect
      aria-label="Printer"
      size="sm"
      value={currentValue}
      disabled={disabled}
      onChange={onChange}
      className={paused ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : undefined}
    >
      <option value="">Printer: not set</option>
      {row.printer && !currentOption ? (
        <option value={currentValue}>
          {configuredPrinter
            ? configuredPrinter.outOfService
              ? `${configuredPrinter.name} (paused) · pick another`
              : configuredPrinter.name
            : `${row.printer} (not in Settings)`}
        </option>
      ) : null}
      {row.colour ? (
        <>
          {options.matching.length ? (
            <optgroup label={`Has ${row.colour} loaded`}>
              {options.matching.map((p) => <option key={p.name} value={p.name}>{p.label}</option>)}
            </optgroup>
          ) : null}
          {options.other.length ? (
            <optgroup label="Other printers (override colour)">
              {options.other.map((p) => <option key={p.name} value={p.name}>{p.label}</option>)}
            </optgroup>
          ) : null}
        </>
      ) : [...options.matching, ...options.other].map((p) => (
        <option key={p.name} value={p.name}>{p.label}</option>
      ))}
    </NativeSelect>
  );
}

function desktopSubscribe(callback: () => void) {
  const media = window.matchMedia("(min-width: 768px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const desktopSnapshot = () => window.matchMedia("(min-width: 768px)").matches;
const desktopServerSnapshot = () => false;

function formatDuration(at: number, now: number) {
  const minutes = Math.round((now - at) / 60_000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function projectAxis(axis: [number, number, number], rotation: { x: number; y: number; z: number }) {
  const [x0, y0, z0] = axis;
  const sx = Math.sin(rotation.x);
  const cx = Math.cos(rotation.x);
  const sy = Math.sin(rotation.y);
  const cy = Math.cos(rotation.y);
  const sz = Math.sin(rotation.z);
  const cz = Math.cos(rotation.z);
  const y1 = y0 * cx - z0 * sx;
  const z1 = y0 * sx + z0 * cx;
  const x2 = x0 * cy + z1 * sy;
  const x3 = x2 * cz - y1 * sz;
  const y3 = x2 * sz + y1 * cz;
  return { x: 26 + x3 * 16, y: 26 - y3 * 16 };
}

export default function SubmissionCard({
  row, position, isOwner = false, showStatusBadge = false, showSelection = false,
  selected = false, onSelectionChange, printerOptions, settingsPrinters, queueOrder = [], onMoveTo,
  dragHandle, dragStyle, isDragging = false,
}: {
  row: BoardRow; position?: number; isOwner?: boolean; showStatusBadge?: boolean;
  showSelection?: boolean; selected?: boolean; onSelectionChange?: (checked: boolean) => void;
  printerOptions: PrinterGroups; queueOrder?: Id<"submissions">[];
  settingsPrinters: PrinterSetting[];
  onMoveTo?: (beforeId?: Id<"submissions">) => Promise<void>;
  dragHandle?: ReactNode; dragStyle?: DragStyle; isDragging?: boolean;
}) {
  const swatch = useSwatch();
  const approve = useMutation(api.queue.approve);
  const approveForVoting = useMutation(api.queue.approveForVoting);
  const startPrinting = useMutation(api.queue.startPrinting);
  const setPrinter = useMutation(api.queue.setPrinter);
  const markDone = useMutation(api.queue.markDone);
  const removeFromCompetition = useMutation(api.queue.removeFromCompetition);
  const restoreToCompetition = useMutation(api.queue.restoreToCompetition);
  const restorePrintRequest = useMutation(api.queue.restorePrintRequest);
  const moveBack = useMutation(api.queue.moveBack);
  const moveTo = useMutation(api.queue.moveTo);
  const download = useDownloadSubmission();
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectKind, setRejectKind] = useState<"review" | "print_failed">("review");
  const [busy, setBusy] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [targetPosition, setTargetPosition] = useState(String(position ?? 1));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<"image" | "3d">("image");
  const [inline3d, setInline3d] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotation, setRotation] = useState({ x: -0.35, y: 0.65, z: 0 });
  const [zoom, setZoom] = useState(1);
  const desktop = useSyncExternalStore(desktopSubscribe, desktopSnapshot, desktopServerSnapshot);
  const now = useNow(30_000);
  const voteOnly = row.designEntry && !row.printRequested;
  const withdrawn = row.participantNotice?.kind === "withdrawn";
  const approvedForVoting = row.status === "submitted" && voteOnly && row.votingApprovedAt !== undefined;
  const alreadyHasPrint = row.participantPrint !== null && row.participantPrint.printCode !== row.printCode;
  const printBadge = voteOnly
    ? alreadyHasPrint && row.participantPrint
      ? `Print is ${row.participantPrint.printCode} · ${row.participantPrint.status === "done" ? "printed" : row.participantPrint.status}`
      : null
    : row.status === "submitted" || row.status === "rejected"
      ? alreadyHasPrint && row.participantPrint
        ? row.participantPrint.status === "done"
          ? `Already printed · ${row.participantPrint.printCode}`
          : row.participantPrint.status === "printing"
            ? `Printing · ${row.participantPrint.printCode}`
            : `Print queued · ${row.participantPrint.printCode}`
        : "No print yet"
      : null;
  const showVotingBadge = showStatusBadge || withdrawn || !row.designEntry || row.designRemoved;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); toast.success(`${row.printCode} ${label}`); }
    catch (error) { toast.error(errorMessage(error, "Action failed")); }
    finally { setBusy(false); }
  }

  async function placeAt(positionValue: number) {
    const next = queueOrder.filter((id) => id !== row._id);
    const beforeId = next[positionValue - 1];
    if (onMoveTo) await onMoveTo(beforeId);
    else await moveTo({ id: row._id, ...(beforeId ? { beforeId } : {}) });
  }

  const statusLine = row.status === "queued" ? `#${position ?? row.queueOrder ?? "–"} in queue`
    : row.status === "printing" ? `${formatDuration(row.printingAt ?? row._creationTime, now)} on printer`
      : row.status === "done" ? "Done"
        : row.status === "rejected" ? row.rejectionKind === "print_failed" ? "Print failed" : "Rejected"
          : withdrawn ? `withdrawn ${formatDuration(row.participantNotice?.at ?? row._creationTime, now)}`
            : approvedForVoting ? "Approved for voting"
              : `waiting ${formatDuration(row._creationTime, now)}`;
  const printerSetting = row.printer
    ? settingsPrinters.find((printer) => printer.name.toLowerCase() === row.printer?.toLowerCase())
    : undefined;
  const printerPaused = Boolean(printerSetting?.outOfService);
  const timeline = [
    ["Submitted", row._creationTime, true],
    ["Queued", row.queuedAt, row.queuedAt !== undefined],
    ["Printing", row.printingAt, row.printingAt !== undefined],
    [row.status === "rejected" ? row.rejectionKind === "print_failed" ? "Print failed" : "Rejected" : "Done", row.doneAt ?? row.rejectedAt ?? row.votingApprovedAt, row.doneAt !== undefined || row.rejectedAt !== undefined || row.votingApprovedAt !== undefined],
  ] as const;
  const axisMarker = [
    ["X", "#dc2626", projectAxis([1, 0, 0], rotation)],
    ["Y", "#16a34a", projectAxis([0, 1, 0], rotation)],
    ["Z", "#2563eb", projectAxis([0, 0, 1], rotation)],
  ] as const;

  return (
    <li
      ref={dragStyle?.ref}
      style={dragStyle?.style}
      className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-card)", (alreadyHasPrint || withdrawn) && "opacity-60 hover:opacity-100", isDragging && "z-10 opacity-70 shadow-xl")}
    >
      <div className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-x-3.5 gap-y-1 p-3 sm:grid-cols-[22px_128px_minmax(0,1fr)_auto] sm:gap-y-2 sm:px-3.5 sm:py-3">
        <div className="flex min-h-8 items-center justify-center">
          {showSelection && row.status === "queued" ? (
            <Checkbox aria-label={`Select ${row.printCode}`} checked={selected} onCheckedChange={(v) => onSelectionChange?.(v === true)} />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[11px] leading-4 text-muted-foreground">{statusLine}</p>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            {dragHandle}
            <span className="whitespace-nowrap font-mono text-[26px] font-semibold leading-[1.1] tracking-tight tabular-nums">{row.printCode}</span>
          </div>
        </div>

        <div className="col-span-2 min-w-0 sm:col-span-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <h3 className="min-w-0 text-[15px] font-semibold">{row.title}</h3>
            {row.version > 1 ? <CardBadge>v{row.version}</CardBadge> : null}
            {printBadge ? <CardBadge tone={printBadge === "No print yet" ? "filled" : "outline"}>{printBadge}</CardBadge> : null}
            {voteOnly ? <CardBadge><Trophy className="size-3" />Vote only</CardBadge> : null}
            {showVotingBadge ? <CardBadge tone={row.designRemoved ? "red" : "outline"}><Trophy className="size-3" />{row.designRemoved ? "Removed from voting" : withdrawn ? "Not in voting" : row.designEntry ? "In voting" : "Not in voting"}</CardBadge> : null}
            {row.oversize ? <CardBadge tone="red">Over size limit</CardBadge> : null}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{row.participantUsername}</p>
          <p className="text-sm text-muted-foreground">{row.participantName}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <i
                className="size-3 rounded-full border border-black/10"
                style={row.colour
                  ? { backgroundColor: swatch(row.colour) }
                  : { backgroundImage: "conic-gradient(#e11d48 0deg 90deg, #eab308 90deg 180deg, #16a34a 180deg 270deg, #3b82f6 270deg 360deg)" }}
              />
              {row.colour || "Any colour"}
            </span>
            {row.dimensionsMm ? <span>{formatDimensions(row.dimensionsMm)}</span> : null}
            {row.printer ? <span className={cn("inline-flex items-center gap-1", printerPaused ? "text-amber-700 dark:text-amber-300" : "")}>{row.status === "done" ? <Printer className="size-3.5" /> : null}{row.printer}{printerPaused ? " · paused" : ""}</span> : null}
            <span>{row.kind.toUpperCase()} · {formatBytes(row.sizeBytes)}</span>
            {row.status === "queued" ? <span>queued {formatDuration(row.queuedAt ?? row._creationTime, now)} ago</span> : null}
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
            <Button size="sm" variant="outline" onClick={() => download(row._id, row.downloadName).catch((e) => toast.error(errorMessage(e, "Download failed")))}>
              <Download data-icon="inline-start" />Download
            </Button>
            <span className="min-w-0 break-all font-mono text-xs text-muted-foreground sm:truncate sm:whitespace-nowrap">{row.downloadName}</span>
          </div>
        </div>

        <div className="col-span-2 flex min-w-0 flex-col items-stretch gap-1.5 sm:col-span-1 sm:max-w-[30rem] sm:items-end">
          <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:flex-nowrap">
          {row.status === "submitted" && !withdrawn && !approvedForVoting ? (
            <>
              {!alreadyHasPrint && (!voteOnly || !row.designRemoved) ? <Button size="sm" disabled={busy} onClick={() => run(voteOnly ? "approved for voting" : "approved", () => voteOnly ? approveForVoting({ id: row._id }) : approve({ id: row._id }))}>
                <Check data-icon="inline-start" />{voteOnly ? "Approve for voting" : "Approve"}
              </Button> : null}
              <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive" disabled={busy} onClick={() => { setRejectKind("review"); setRejecting(true); }}><X data-icon="inline-start" />Reject…</Button>
            </>
          ) : null}
          {row.status === "queued" ? (
            <>
              <PrinterSelect row={row} value={row.printer ?? ""} disabled={busy} options={printerOptions} settingsPrinters={settingsPrinters} paused={printerPaused} onChange={(e) => void run("printer updated", () => setPrinter({ id: row._id, printer: e.currentTarget.value || undefined }))} />
              <Button size="sm" disabled={busy || !row.printer || printerPaused} title={!row.printer ? "Assign a printer first" : printerPaused ? "Pick another printer first" : undefined} onClick={() => run("printing", () => startPrinting({ id: row._id }))}><Printer data-icon="inline-start" />Start printing</Button>
            </>
          ) : null}
          {row.status === "printing" ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => run("done", () => markDone({ id: row._id }))}><Check data-icon="inline-start" />Mark done</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setRejectKind("print_failed"); setRejecting(true); }}>Print failed…</Button>
            </>
          ) : null}
          {withdrawn && row.restorePrint ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={busy || !row.restorePrint.ok} title={row.restorePrint.ok ? undefined : row.restorePrint.reason} onClick={() => setRestoreOpen(true)}>
                <Undo2 data-icon="inline-start" />Restore print request
              </Button>
              {!row.restorePrint.ok ? <small className="max-w-64 text-xs text-muted-foreground">{row.restorePrint.reason}</small> : null}
            </div>
          ) : row.status === "rejected" ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run("moved back", () => moveBack({ id: row._id }))}><Undo2 data-icon="inline-start" />Unreject</Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label={`More actions for ${row.printCode}`} />}>
              <Ellipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {row.status !== "submitted" || approvedForVoting ? (
                <DropdownMenuItem onClick={() => void run("moved back", () => moveBack({ id: row._id }))}>
                  <Undo2 />{approvedForVoting ? "Move back to Needs review" : "Move back"}
                </DropdownMenuItem>
              ) : null}
              {row.status === "queued" ? (
                <>
                  <DropdownMenuItem disabled={busy || position === 1} onClick={() => void run("moved to top", () => placeAt(1))}>Move to top</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setTargetPosition(String(position ?? 1)); setPositionOpen(true); }}>Move to position…</DropdownMenuItem>
                </>
              ) : null}
              {row.status === "printing" || row.status === "done" ? <DropdownMenuItem onClick={() => setPrinterOpen(true)}><Printer />Change printer</DropdownMenuItem> : null}
              {row.designRemoved ? (
                <DropdownMenuItem onClick={() => void run("restored to the competition", () => restoreToCompetition({ id: row._id }))}><Trophy />Restore to competition</DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => download(row._id, row.downloadName).catch((e) => toast.error(errorMessage(e, "Download failed")))}><Download />Download file</DropdownMenuItem>
              {isOwner ? <DropdownMenuItem onClick={() => setHistoryOpen(true)}><History />History</DropdownMenuItem> : null}
              {(row.status === "submitted" && !approvedForVoting && !withdrawn) || row.status === "queued" || (row.designEntry && !row.designRemoved) ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>DANGER ZONE</DropdownMenuLabel>
                    {(row.status === "submitted" && !approvedForVoting && !withdrawn) || row.status === "queued" ? <DropdownMenuItem variant="destructive" className="flex-wrap" onClick={() => { setRejectKind("review"); setRejecting(true); }}>
                      <X />Reject… <span className="basis-full pl-6 text-xs text-muted-foreground">Participant sees your comment and can upload a fix.</span>
                    </DropdownMenuItem> : null}
                    {row.designEntry && !row.designRemoved ? <DropdownMenuItem variant="destructive" className="flex-wrap" onClick={() => setRemoveOpen(true)}><Trophy />Remove from competition… <span className="basis-full pl-6 text-xs text-muted-foreground">Pulls it from voting, leaderboard and TV. Printing is unaffected.</span></DropdownMenuItem> : null}
                  </DropdownMenuGroup>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
          <Button size="sm" variant="ghost" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            Details <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          </Button>
        </div>
      </div>

      {printerPaused && (row.status === "queued" || row.status === "printing") ? (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Pause className="size-4 shrink-0" />
          <span><strong>{row.printer} is paused</strong>: not taking new jobs. Pick another printer.</span>
        </div>
      ) : null}
      {row.colour && !row.printersWithColour.length && row.status !== "done" && !voteOnly && !withdrawn ? <div className="border-t border-amber-200 px-4 py-2 text-sm text-muted-foreground">No printer has this colour loaded</div> : null}
      {row.participantNotice ? <Alert className="m-3"><AlertDescription>{row.participantNotice.kind === "withdrawn" ? "Withdrawn by participant: print request removed" : row.participantNotice.kind === "replaced" ? `Replaced by participant (v${row.participantNotice.version}), needs re-approval` : `Restored by owner (v${row.participantNotice.version}), needs re-approval · ${formatDateTime(row.participantNotice.at)}`}</AlertDescription></Alert> : null}
      {row.status === "rejected" && row.rejectionReason ? <p className="border-t px-4 py-2 text-sm text-destructive">{row.rejectionKind === "print_failed" ? "Print failed" : "Rejected"} · {row.rejectionReason}</p> : null}
      {row.notes ? <div className="mx-3 mb-3 rounded-lg bg-muted px-3 py-2 text-sm text-foreground"><span className="mr-2 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">NOTE FROM PARTICIPANT</span>{row.notes}</div> : null}

      {expanded ? (
        <div className="grid gap-5 border-t bg-muted/20 p-4 md:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)]">
          <section>
            <h4 className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Preview</h4>
            <div className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-card">
              {inline3d && row.fileUrl ? <ModelViewer url={row.fileUrl} kind={row.kind} colour={swatch(row.colour)} interactive autoRotate className="h-full" /> :
                row.previewUrl ? <img src={row.previewUrl} alt={row.title} className="size-full object-contain" /> : <div className="grid size-full place-items-center text-sm text-muted-foreground">Preview unavailable</div>}
              {row.fileUrl && desktop ? (
                <Button
                  size="xs"
                  variant="outline"
                  className="absolute bottom-2 right-2 bg-card/95 shadow-sm"
                  onClick={() => { setPreviewTab("image"); setPreviewOpen(true); }}
                >
                  <Eye data-icon="inline-start" />Enlarge
                </Button>
              ) : null}
            </div>
            {row.fileUrl ? <div className="mt-2 flex">
              <Button size="sm" variant="outline" aria-pressed={inline3d} onClick={() => desktop ? (setAutoRotate(true), setPreviewTab("3d"), setPreviewOpen(true)) : setInline3d((v) => !v)}><Box data-icon="inline-start" />{inline3d ? "Close 3D view" : "Open 3D view"}</Button>
            </div> : null}
          </section>
          <section>
            <h4 className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Details</h4>
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3.5 gap-y-1 text-xs [&_dd]:m-0">
              <dt className="text-muted-foreground">Colour</dt><dd>{row.colour ?? "Any colour"}</dd>
              <dt className="text-muted-foreground">Size</dt><dd>{row.dimensionsMm ? formatDimensions(row.dimensionsMm) : "Unknown"}</dd>
              <dt className="text-muted-foreground">File</dt><dd>{row.kind.toUpperCase()} · {formatBytes(row.sizeBytes)}</dd>
              {!voteOnly ? <><dt className="text-muted-foreground">Printers with colour</dt><dd>{row.printersWithColour.join(", ") || "None loaded"}</dd></> : null}
              <dt className="text-muted-foreground">Voting</dt><dd>{row.designRemoved ? "Removed from voting" : row.designEntry ? "In voting" : "Not in voting"}</dd>
              <dt className="text-muted-foreground">Username</dt><dd>{row.participantUsername}</dd>
              <dt className="text-muted-foreground">Name</dt><dd>{row.participantName}</dd>
              {isOwner ? <><dt className="text-muted-foreground">Email</dt><dd>{row.participantEmail}</dd></> : null}
            </dl>
          </section>
          <section>
            <h4 className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Timeline</h4>
            <ol className="m-0 list-none space-y-0.5 p-0 text-xs">
              {approvedForVoting ? (
                <>
                  <li className="flex items-center gap-2 py-0.5"><span className="size-[7px] shrink-0 rounded-full bg-foreground" />Submitted · {formatDateTime(row._creationTime)}</li>
                  {row.votingApprovedAt !== undefined ? <li className="flex items-center gap-2 py-0.5"><span className="size-[7px] shrink-0 rounded-full bg-foreground" />Approved for voting · {formatDateTime(row.votingApprovedAt)}</li> : null}
                  <li className="flex items-center gap-2 py-0.5 text-muted-foreground"><span className="size-[7px] shrink-0 rounded-full bg-muted-foreground/30" />Not printed (vote only)</li>
                </>
              ) : timeline.map(([label, at, done]) => (
                <li key={label} className={cn("flex items-center gap-2 py-0.5", !done && "text-muted-foreground")}>
                  <span className={cn("size-[7px] shrink-0 rounded-full", done ? "bg-foreground" : "bg-muted-foreground/30")} />
                  <span>{label}{at !== undefined ? ` · ${formatDateTime(at)}` : ""}</span>
                </li>
              ))}
              {row.rejectionReason ? <li className="text-destructive">{row.rejectionKind === "print_failed" ? "Print failed" : "Rejected"} · {row.rejectionReason}</li> : null}
            </ol>
            {isOwner ? <Button size="sm" variant="outline" className="mt-3" onClick={() => setHistoryOpen(true)}><History data-icon="inline-start" />Full history</Button> : null}
          </section>
        </div>
      ) : null}

      <RejectDialog submissionId={row._id} printCode={row.printCode} open={rejecting} onOpenChange={setRejecting} kind={rejectKind} designEntry={row.designEntry && !row.designRemoved} />
      <HistoryDialog submissionId={row._id} open={historyOpen} onOpenChange={setHistoryOpen} trigger={false} />
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {row.printCode} from the competition?</AlertDialogTitle><AlertDialogDescription>Its votes no longer count. Printing is unaffected.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void run("removed from the competition", () => removeFromCompetition({ id: row._id }))}>Remove from competition</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restore {row.printCode}&apos;s print request?</AlertDialogTitle><AlertDialogDescription>{row.restorePrint && "movesFrom" in row.restorePrint && row.restorePrint.movesFrom ? `This moves the print request back from ${row.restorePrint.movesFrom}.` : "This restores the participant's withdrawn print request."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void run("print request restored", () => restorePrintRequest({ id: row._id }))}>Restore print request</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <Dialog open={printerOpen} onOpenChange={setPrinterOpen}><DialogContent><DialogHeader><DialogTitle>Change printer · {row.printCode}</DialogTitle><DialogDescription>Choose a printer for this job.</DialogDescription></DialogHeader><PrinterSelect row={row} value={row.printer ?? ""} disabled={busy} options={printerOptions} settingsPrinters={settingsPrinters} paused={printerPaused} onChange={(e) => { const printer = e.currentTarget.value; void run("printer updated", () => setPrinter({ id: row._id, printer: printer || undefined })).then(() => setPrinterOpen(false)); }} /><DialogFooter><Button variant="outline" onClick={() => setPrinterOpen(false)}>Close</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={positionOpen} onOpenChange={setPositionOpen}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Move {row.printCode}</DialogTitle><DialogDescription>Choose a queue position from 1 to {queueOrder.length}.</DialogDescription></DialogHeader><Field><FieldLabel htmlFor={`position-${row._id}`}>Position</FieldLabel><input id={`position-${row._id}`} type="number" min={1} max={queueOrder.length} value={targetPosition} onChange={(e) => setTargetPosition(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-3" /></Field><DialogFooter><Button variant="outline" onClick={() => setPositionOpen(false)}>Cancel</Button><Button disabled={busy || Number(targetPosition) < 1 || Number(targetPosition) > queueOrder.length} onClick={() => void run("moved", () => placeAt(Number(targetPosition))).then(() => setPositionOpen(false))}>Move</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl gap-0 overflow-y-auto p-0 sm:max-w-3xl">
          <div className="flex items-start justify-between gap-3 border-b p-4 pr-12">
            <DialogHeader className="min-w-0 gap-0.5">
              <DialogTitle className="font-mono text-2xl leading-none">{row.printCode}</DialogTitle>
              <DialogDescription className="truncate">
                <span className="text-foreground">{row.title}</span>
                <span className="text-muted-foreground"> · {row.participantUsername}</span>
              </DialogDescription>
            </DialogHeader>
            <div role="group" aria-label="Preview mode" className="inline-flex shrink-0 items-center rounded-lg bg-muted p-1">
              <Button type="button" size="xs" variant="ghost" aria-pressed={previewTab === "image"} className={cn("h-7 rounded-md px-2", previewTab === "image" && "bg-background text-foreground shadow-sm")} onClick={() => setPreviewTab("image")}>
                <ImageIcon className="size-3.5" />Image
              </Button>
              <Button type="button" size="xs" variant="ghost" aria-pressed={previewTab === "3d"} className={cn("h-7 rounded-md px-2", previewTab === "3d" && "bg-background text-foreground shadow-sm")} onClick={() => setPreviewTab("3d")}>
                <Box className="size-3.5" />3D
              </Button>
            </div>
          </div>
          {previewTab === "image" ? row.previewUrl
            ? <div className="grid h-[min(68vh,640px)] min-h-[320px] place-items-center bg-muted/20 p-4"><img src={row.previewUrl} alt={row.title} className="max-h-full max-w-full object-contain" /></div>
            : <p className="grid h-[min(68vh,640px)] min-h-[320px] place-items-center text-sm text-muted-foreground">Preview unavailable</p>
            : row.fileUrl
              ? <div className="relative h-[min(68vh,640px)] min-h-[360px] overflow-hidden bg-[radial-gradient(circle_at_50%_40%,var(--card),var(--muted))]">
                  <ModelViewer
                    url={row.fileUrl}
                    kind={row.kind}
                    colour={swatch(row.colour)}
                    interactive
                    autoRotate={autoRotate}
                    rotation={rotation}
                    zoom={zoom}
                    onRotationChange={(next) => { setAutoRotate(false); setRotation(next); }}
                    onZoomChange={(next) => { setAutoRotate(false); setZoom(next); }}
                    className="h-full w-full aspect-auto"
                  />
                  <div className="absolute right-3 top-3 rounded-md bg-background/85 px-2 py-1 font-mono text-[11px] text-muted-foreground">Drag to spin · Shift+drag to roll · Scroll to zoom</div>
                  <svg aria-hidden="true" viewBox="0 0 52 52" className="pointer-events-none absolute bottom-3 left-3 size-12">
                    {axisMarker.map(([label, colour, point]) => (
                      <g key={label}>
                        <line x1="26" y1="26" x2={point.x} y2={point.y} stroke={colour} strokeWidth="2" />
                        <text x={point.x + 2} y={point.y - 2} fill={colour} fontSize="8">{label}</text>
                      </g>
                    ))}
                  </svg>
                </div>
              : null}
          {previewTab === "3d" ? (
            <div className="border-t">
              <div className="flex flex-wrap items-center gap-1.5 p-3">
                <Button type="button" size="sm" variant={autoRotate ? "secondary" : "outline"} aria-pressed={autoRotate} onClick={() => setAutoRotate((value) => !value)}>
                  {autoRotate ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}Auto-rotate {autoRotate ? "on" : "off"}
                </Button>
                <span className="ml-1 text-xs text-muted-foreground">View</span>
                {[
                  ["Front", { x: 0, y: 0, z: 0 }],
                  ["Back", { x: 0, y: Math.PI, z: 0 }],
                  ["Side", { x: 0, y: Math.PI / 2, z: 0 }],
                  ["Top", { x: -Math.PI / 2, y: 0, z: 0 }],
                  ["3/4", { x: -0.35, y: 0.65, z: 0 }],
                ].map(([label, view]) => (
                  <Button key={String(label)} type="button" size="xs" variant="outline" onClick={() => { setAutoRotate(false); setRotation(view as typeof rotation); }}>{label as string}</Button>
                ))}
                <span className="flex-1" />
                <Button type="button" size="icon-sm" variant="outline" aria-label="Zoom out" title="Zoom out" onClick={() => { setAutoRotate(false); setZoom((value) => Math.max(0.5, value / 1.2)); }}><Minus /></Button>
                <Button type="button" size="icon-sm" variant="outline" aria-label="Zoom in" title="Zoom in" onClick={() => { setAutoRotate(false); setZoom((value) => Math.min(3, value * 1.2)); }}><Plus /></Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setAutoRotate(false); setRotation({ x: -0.35, y: 0.65, z: 0 }); setZoom(1); }}><RotateCcw data-icon="inline-start" />Reset</Button>
              </div>
              <div className="grid gap-3 border-t px-3 py-3 sm:grid-cols-3">
                {(["x", "y", "z"] as const).map((axis, index) => {
                  const label = ["Tilt", "Turn", "Roll"][index];
                  const degrees = Math.round(rotation[axis] * 180 / Math.PI);
                  return (
                    <label key={axis} className="grid grid-cols-[5.2rem_minmax(0,1fr)_2.2rem] items-center gap-2 text-xs">
                      <span>{label} · {axis.toUpperCase()}</span>
                      <input aria-label={`${label} · ${axis.toUpperCase()}`} className="w-full accent-foreground" type="range" min="-180" max="180" step="1" value={degrees} onChange={(event) => { setAutoRotate(false); setRotation({ ...rotation, [axis]: Number(event.target.value) * Math.PI / 180 }); }} />
                      <output className="text-right font-mono tabular-nums">{degrees}°</output>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t p-3 text-xs">
            <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-full border border-black/10" style={row.colour ? { backgroundColor: swatch(row.colour) } : { backgroundImage: "conic-gradient(#e11d48, #eab308, #16a34a, #3b82f6, #e11d48)" }} />{row.colour || "Any colour"}</span>
            <span>{row.dimensionsMm ? formatDimensions(row.dimensionsMm) : "Unknown size"}</span>
            <span className="font-mono">{row.kind.toUpperCase()} · {formatBytes(row.sizeBytes)}</span>
            <Button size="sm" variant="outline" onClick={() => download(row._id, row.downloadName).catch((e) => toast.error(errorMessage(e, "Download failed")))}><Download data-icon="inline-start" />Download</Button>
            <span className="min-w-0 flex-1 basis-full break-all font-mono text-[11px] text-muted-foreground sm:basis-auto">{row.downloadName}</span>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}
