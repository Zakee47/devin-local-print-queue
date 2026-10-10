"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Check, ChevronDown, Download, Ellipsis, Eye, Pause, Printer,
  Trophy, Undo2, X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSwatch } from "@/lib/use-swatch";
import { formatDateTime } from "@/lib/datetime";
import { formatDimensions } from "@/lib/dimensions";
import { useNow } from "@/components/admin/use-now";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
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

function PrinterSelect({
  row, value, disabled, onChange, options,
}: {
  row: BoardRow; value: string; disabled?: boolean;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options: PrinterGroups;
}) {
  const currentUnavailable = Boolean(row.printer && ![...options.matching, ...options.other].some((p) => p.name === row.printer));
  return (
    <NativeSelect aria-label="Printer" size="sm" value={value} disabled={disabled} onChange={onChange}>
      <option value="">Printer: not set</option>
      {currentUnavailable ? <option value={row.printer!}>{row.printer} (paused)</option> : null}
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

function timeAgo(at: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

export default function SubmissionCard({
  row, position, isOwner = false, showStatusBadge = false, showSelection = false,
  selected = false, onSelectionChange, printerOptions, queueOrder = [], onMoveTo,
  dragHandle, dragStyle, isDragging = false, variant = "full",
}: {
  row: BoardRow; position?: number; isOwner?: boolean; showStatusBadge?: boolean;
  showSelection?: boolean; selected?: boolean; onSelectionChange?: (checked: boolean) => void;
  printerOptions: PrinterGroups; queueOrder?: Id<"submissions">[];
  onMoveTo?: (beforeId?: Id<"submissions">) => Promise<void>;
  dragHandle?: ReactNode; dragStyle?: DragStyle; isDragging?: boolean;
  variant?: "full" | "ticket";
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
  const [previewInteracted, setPreviewInteracted] = useState(false);
  const [rotation, setRotation] = useState({ x: -0.35, y: 0.65, z: 0 });
  const [zoom, setZoom] = useState(1);
  const desktop = useSyncExternalStore(desktopSubscribe, desktopSnapshot, desktopServerSnapshot);
  const now = useNow(30_000);
  const voteOnly = row.designEntry && !row.printRequested;
  const withdrawn = row.participantNotice?.kind === "withdrawn";
  const approvedForVoting = row.status === "submitted" && voteOnly && row.votingApprovedAt !== undefined;
  const alreadyHasPrint = row.participantPrint !== null && row.participantPrint.printCode !== row.printCode;
  const printBadge = row.participantPrint
    ? row.participantPrint.status === "done" ? `Already printed · ${row.participantPrint.printCode}`
      : row.participantPrint.status === "printing" ? `Printing · ${row.participantPrint.printCode}`
        : `Print queued · ${row.participantPrint.printCode}`
    : row.printRequestCode ? `Print is ${row.printRequestCode}` : "No print yet";

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
    : row.status === "printing" ? `${timeAgo(row.printingAt ?? row._creationTime, now).replace(" ago", "")} on printer`
      : row.status === "done" ? "Done"
        : row.status === "rejected" ? row.rejectionKind === "print_failed" ? "Print failed" : "Rejected"
          : withdrawn ? "Withdrawn"
            : approvedForVoting ? "Approved for voting"
              : `waiting ${timeAgo(row._creationTime, now).replace(" ago", "")}`;
  const printerPaused = Boolean(row.printer && row.printerOutOfService);
  const timeline = [
    ["Submitted", row._creationTime, true],
    ["Queued", row.queuedAt, row.status === "queued" || row.status === "printing" || row.status === "done"],
    ["Printing", row.printingAt, row.status === "printing" || row.status === "done"],
    ["Done", row.doneAt ?? row.votingApprovedAt, row.status === "done" || approvedForVoting],
  ] as const;

  return (
    <li
      ref={dragStyle?.ref}
      style={dragStyle?.style}
      className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-card)", variant === "ticket" && "rounded-lg shadow-none", alreadyHasPrint && "opacity-55 hover:opacity-100", isDragging && "z-10 opacity-70 shadow-xl")}
    >
      <div className={cn("grid gap-3 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-start sm:gap-4 sm:p-4", variant === "ticket" && "gap-2 p-2 sm:gap-2 sm:p-2")}>
        <div className="flex items-center gap-2 sm:w-36 sm:flex-col sm:items-start">
          <div className="flex items-center gap-2">
            {dragHandle}
            {showSelection && row.status === "queued" ? (
              <Checkbox aria-label={`Select ${row.printCode}`} checked={selected} onCheckedChange={(v) => onSelectionChange?.(v === true)} />
            ) : null}
            <span className={cn("font-mono text-3xl font-semibold tracking-tight tabular-nums", variant === "ticket" && "text-2xl")}>{row.printCode}</span>
          </div>
          {variant !== "ticket" && row.version > 1 ? <Badge variant="outline">v{row.version}</Badge> : null}
          {variant !== "ticket" && showStatusBadge ? <Badge variant="outline">{row.status}</Badge> : null}
          {variant !== "ticket" && (row.status === "submitted" || row.status === "rejected") ? (
            <Badge variant={alreadyHasPrint ? "outline" : "secondary"}>{printBadge}</Badge>
          ) : null}
          {variant !== "ticket" && voteOnly ? <Badge variant="outline">{approvedForVoting ? "Approved for voting" : "Vote only"}</Badge> : null}
          {variant !== "ticket" && (row.designRemoved ? <Badge variant="outline">Removed from voting</Badge> : row.designEntry ? <Badge variant="outline">In voting</Badge> : null)}
          {variant !== "ticket" && row.oversize ? <Badge variant="destructive">Over size limit</Badge> : null}
          {variant !== "ticket" && position !== undefined ? <span className="font-mono text-xs text-muted-foreground">#{position}</span> : null}
        </div>

        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{statusLine}</p>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="min-w-0 truncate text-base font-semibold">{row.title}</h3>
            <span className="text-sm text-muted-foreground">@{row.participantUsername}</span>
          </div>
          {variant !== "ticket" ? <p className="text-sm text-muted-foreground">{row.participantName}</p> : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {row.colour ? <span className="inline-flex items-center gap-1"><i className="size-3 rounded-full border border-black/10" style={{ backgroundColor: swatch(row.colour) }} />{row.colour}</span> : null}
            {variant !== "ticket" && row.dimensionsMm ? <span>{formatDimensions(row.dimensionsMm)} mm</span> : null}
            {variant !== "ticket" && row.printer ? <span className={printerPaused ? "text-amber-700 dark:text-amber-300" : ""}>{row.printer}{printerPaused ? " · paused" : ""}</span> : null}
            {variant !== "ticket" ? <span>{row.kind.toUpperCase()} · {formatBytes(row.sizeBytes)}</span> : null}
            {variant !== "ticket" && row.status === "queued" ? <span>queued {timeAgo(row.queuedAt ?? row._creationTime, now)}</span> : null}
          </div>
          {variant !== "ticket" ? <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => download(row._id, row.downloadName).catch((e) => toast.error(errorMessage(e, "Download failed")))}>
              <Download data-icon="inline-start" />Download
            </Button>
            <span className="break-all font-mono text-xs text-muted-foreground">{row.downloadName}</span>
          </div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:max-w-72 sm:justify-end">
          {row.status === "submitted" && !withdrawn && !approvedForVoting ? (
            <>
              {!alreadyHasPrint && (!voteOnly || !row.designRemoved) ? <Button size="sm" disabled={busy} onClick={() => run(voteOnly ? "approved for voting" : "approved", () => voteOnly ? approveForVoting({ id: row._id }) : approve({ id: row._id }))}>
                <Check data-icon="inline-start" />{voteOnly ? "Approve for voting" : "Approve"}
              </Button> : null}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setRejectKind("review"); setRejecting(true); }}><X data-icon="inline-start" />Reject…</Button>
            </>
          ) : null}
          {row.status === "queued" ? (
            <>
              <PrinterSelect row={row} value={row.printer ?? ""} disabled={busy} options={printerOptions} onChange={(e) => void run("printer updated", () => setPrinter({ id: row._id, printer: e.currentTarget.value || undefined }))} />
              <Button size="sm" disabled={busy || !row.printer || row.printerOutOfService} title={!row.printer ? "Assign a printer first" : row.printerOutOfService ? "Pick another printer first" : undefined} onClick={() => run("printing", () => startPrinting({ id: row._id }))}><Printer data-icon="inline-start" />Start printing</Button>
            </>
          ) : null}
          {row.status === "printing" ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => run("done", () => markDone({ id: row._id }))}><Check data-icon="inline-start" />Mark done</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setRejectKind("print_failed"); setRejecting(true); }}>Print failed…</Button>
            </>
          ) : null}
          {withdrawn && row.restorePrint ? (
            <div className="flex flex-col items-start">
              <Button size="sm" disabled={busy || !row.restorePrint.ok} title={row.restorePrint.ok ? undefined : row.restorePrint.reason} onClick={() => setRestoreOpen(true)}>
                Restore print request
              </Button>
              {!row.restorePrint.ok ? <small className="mt-1 max-w-64 text-xs text-muted-foreground">{row.restorePrint.reason}</small> : null}
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
              {isOwner ? <DropdownMenuItem onClick={() => setHistoryOpen(true)}>History</DropdownMenuItem> : null}
              {(row.status === "submitted" && !approvedForVoting && !withdrawn) || row.status === "queued" || (row.designEntry && !row.designRemoved) ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>DANGER ZONE</DropdownMenuLabel>
                  {(row.status === "submitted" && !approvedForVoting && !withdrawn) || row.status === "queued" ? <DropdownMenuItem variant="destructive" className="flex-wrap" onClick={() => { setRejectKind("review"); setRejecting(true); }}>
                    <X />Reject… <span className="basis-full pl-6 text-xs text-muted-foreground">Participant sees your comment and can upload a fix.</span>
                  </DropdownMenuItem> : null}
                  {row.designEntry && !row.designRemoved ? <DropdownMenuItem variant="destructive" className="flex-wrap" onClick={() => setRemoveOpen(true)}><Trophy />Remove from competition… <span className="basis-full pl-6 text-xs text-muted-foreground">Pulls it from voting, leaderboard and TV. Printing is unaffected.</span></DropdownMenuItem> : null}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            Details <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          </Button>
        </div>
      </div>

      {printerPaused && (row.status === "queued" || row.status === "printing") ? <div className="flex items-center gap-2 border-t border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><Pause className="size-4" />{row.printer} is paused · pick another printer</div> : null}
      {row.colour && !row.printersWithColour.length && row.status !== "done" && !voteOnly && !withdrawn ? <div className="border-t border-amber-200 px-4 py-2 text-sm text-muted-foreground">No printer has this colour loaded</div> : null}
      {row.participantNotice ? <Alert className="m-3"><AlertDescription>{row.participantNotice.kind === "withdrawn" ? "Withdrawn by participant: print request removed" : row.participantNotice.kind === "replaced" ? `Replaced by participant (v${row.participantNotice.version}), needs re-approval` : `Restored by owner (v${row.participantNotice.version}), needs re-approval · ${formatDateTime(row.participantNotice.at)}`}</AlertDescription></Alert> : null}
      {row.status === "rejected" && row.rejectionReason ? <p className="border-t px-4 py-2 text-sm text-destructive">{row.rejectionKind === "print_failed" ? "Print failed" : "Rejected"} · {row.rejectionReason}</p> : null}
      {row.notes ? <p className="border-t px-4 py-2 text-sm"><span className="text-xs text-muted-foreground">Notes for organizers · </span>{row.notes}</p> : null}

      {expanded ? (
        <div className="grid gap-5 border-t bg-muted/20 p-4 md:grid-cols-3">
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</h4>
            <div className="relative aspect-square overflow-hidden rounded-lg border bg-card">
              {inline3d && row.fileUrl ? <ModelViewer url={row.fileUrl} kind={row.kind} colour={swatch(row.colour)} interactive autoRotate className="h-full" /> :
                row.previewUrl ? <img src={row.previewUrl} alt={row.title} className="size-full object-contain" /> : <div className="grid size-full place-items-center text-sm text-muted-foreground">Preview unavailable</div>}
            </div>
            {row.fileUrl ? <div className="mt-2 flex gap-2">
              {desktop ? <Button size="sm" variant="outline" onClick={() => { setPreviewInteracted(false); setPreviewTab("image"); setPreviewOpen(true); }}><Eye data-icon="inline-start" />Enlarge</Button> : null}
              <Button size="sm" variant="outline" aria-pressed={inline3d} onClick={() => desktop ? (setPreviewInteracted(false), setPreviewTab("3d"), setPreviewOpen(true)) : setInline3d((v) => !v)}><Eye data-icon="inline-start" />Open 3D view</Button>
            </div> : null}
          </section>
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</h4>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Colour</dt><dd>{row.colour ?? "Any colour"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Size</dt><dd>{row.dimensionsMm ? `${formatDimensions(row.dimensionsMm)} mm` : "Unknown"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">File</dt><dd className="break-all">{row.originalFileName} · {formatBytes(row.sizeBytes)}</dd></div>
              {!voteOnly ? <div><dt className="text-xs text-muted-foreground">Printers with colour</dt><dd>{row.printersWithColour.join(", ") || "None loaded"}</dd></div> : null}
              <div><dt className="text-xs text-muted-foreground">Voting</dt><dd>{row.designRemoved ? "Removed from voting" : row.designEntry ? "In voting" : "Not entered"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Username</dt><dd>@{row.participantUsername}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Name</dt><dd>{row.participantName}</dd></div>
              {isOwner ? <div><dt className="text-xs text-muted-foreground">Email</dt><dd>{row.participantEmail}</dd></div> : null}
            </dl>
          </section>
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h4>
            <ol className="space-y-2 text-sm">
              {timeline.map(([label, at, done]) => <li key={label} className="flex items-start gap-2"><span className={cn("mt-1 size-2 rounded-full", done ? "bg-foreground" : "bg-muted-foreground/30")} /><span>{label}{at ? <small className="ml-2 text-muted-foreground">{formatDateTime(at)}</small> : null}</span></li>)}
              {row.rejectionReason ? <li className="text-destructive">{row.rejectionKind === "print_failed" ? "Print failed" : "Rejected"} · {row.rejectionReason}</li> : null}
            </ol>
            {isOwner ? <Button size="sm" variant="outline" className="mt-3" onClick={() => setHistoryOpen(true)}>Full history</Button> : null}
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
      <Dialog open={printerOpen} onOpenChange={setPrinterOpen}><DialogContent><DialogHeader><DialogTitle>Change printer · {row.printCode}</DialogTitle><DialogDescription>Choose a printer for this job.</DialogDescription></DialogHeader><PrinterSelect row={row} value={row.printer ?? ""} disabled={busy} options={printerOptions} onChange={(e) => { const printer = e.currentTarget.value; void run("printer updated", () => setPrinter({ id: row._id, printer: printer || undefined })).then(() => setPrinterOpen(false)); }} /><DialogFooter><Button variant="outline" onClick={() => setPrinterOpen(false)}>Close</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={positionOpen} onOpenChange={setPositionOpen}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Move {row.printCode}</DialogTitle><DialogDescription>Choose a queue position from 1 to {queueOrder.length}.</DialogDescription></DialogHeader><Field><FieldLabel htmlFor={`position-${row._id}`}>Position</FieldLabel><input id={`position-${row._id}`} type="number" min={1} max={queueOrder.length} value={targetPosition} onChange={(e) => setTargetPosition(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-3" /></Field><DialogFooter><Button variant="outline" onClick={() => setPositionOpen(false)}>Cancel</Button><Button disabled={busy || Number(targetPosition) < 1 || Number(targetPosition) > queueOrder.length} onClick={() => void run("moved", () => placeAt(Number(targetPosition))).then(() => setPositionOpen(false))}>Move</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={previewOpen} onOpenChange={(open) => { setPreviewOpen(open); if (open) setPreviewInteracted(false); }}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>{row.title}</DialogTitle><DialogDescription>{row.printCode} · {row.originalFileName}</DialogDescription></DialogHeader><div className="flex gap-2"><Button size="sm" variant={previewTab === "image" ? "secondary" : "outline"} onClick={() => setPreviewTab("image")}>Image</Button><Button size="sm" variant={previewTab === "3d" ? "secondary" : "outline"} onClick={() => setPreviewTab("3d")}>3D</Button></div>{previewTab === "image" ? row.previewUrl ? <img src={row.previewUrl} alt={row.title} className="mx-auto max-h-[55vh] object-contain" /> : <p className="p-10 text-center text-muted-foreground">Preview unavailable</p> : row.fileUrl ? <ModelViewer url={row.fileUrl} kind={row.kind} colour={swatch(row.colour)} interactive autoRotate={!previewInteracted} rotation={rotation} zoom={zoom} onRotationChange={(next) => { setPreviewInteracted(true); setRotation(next); }} onZoomChange={(next) => { setPreviewInteracted(true); setZoom(next); }} className="mx-auto max-h-[55vh] max-w-3xl" /> : null}
        {previewTab === "3d" ? <div className="flex flex-wrap items-center gap-2"><label className="text-xs">X <input aria-label="X rotation" type="range" min="-3.14" max="3.14" step="0.05" value={rotation.x} onChange={(e) => { setPreviewInteracted(true); setRotation({ ...rotation, x: Number(e.target.value) }); }} /></label><label className="text-xs">Y <input aria-label="Y rotation" type="range" min="-3.14" max="3.14" step="0.05" value={rotation.y} onChange={(e) => { setPreviewInteracted(true); setRotation({ ...rotation, y: Number(e.target.value) }); }} /></label><label className="text-xs">Z <input aria-label="Z rotation" type="range" min="-3.14" max="3.14" step="0.05" value={rotation.z} onChange={(e) => { setPreviewInteracted(true); setRotation({ ...rotation, z: Number(e.target.value) }); }} /></label>{[[0, 0, 0, "Front"], [0, Math.PI, 0, "Back"], [0, Math.PI / 2, 0, "Side"], [-Math.PI / 2, 0, 0, "Top"], [-0.35, 0.65, 0, "3/4"]].map(([x, y, z, label]) => <Button key={String(label)} size="xs" variant="outline" onClick={() => { setPreviewInteracted(true); setRotation({ x: Number(x), y: Number(y), z: Number(z) }); }}>{label}</Button>)}<Button size="xs" variant="outline" onClick={() => { setPreviewInteracted(true); setZoom((v) => Math.max(0.5, v / 1.2)); }}>Zoom −</Button><Button size="xs" variant="outline" onClick={() => { setPreviewInteracted(true); setZoom((v) => Math.min(3, v * 1.2)); }}>Zoom +</Button><Button size="xs" variant="ghost" onClick={() => { setPreviewInteracted(true); setRotation({ x: -0.35, y: 0.65, z: 0 }); setZoom(1); }}>Reset</Button><p className="w-full text-xs text-muted-foreground">Drag to rotate · Shift-drag to roll · Scroll to zoom</p></div> : null}
      </DialogContent></Dialog>
    </li>
  );
}
