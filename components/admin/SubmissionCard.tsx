"use client";

import { useState, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  Printer,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import ModelPreview from "@/components/ModelPreview";
import { swatchFor } from "@/lib/colours";
import { formatDimensions } from "@/lib/dimensions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import RejectDialog from "@/components/admin/RejectDialog";
import { useDownloadSubmission } from "@/components/admin/download";
import { errorMessage } from "@/lib/errors";

export type BoardRow = FunctionReturnType<typeof api.queue.board>[number];

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function PrinterSelect({
  row,
  value,
  disabled,
  onChange,
}: {
  row: BoardRow;
  value: string;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <NativeSelect aria-label="Printer" size="sm" value={value} disabled={disabled} onChange={onChange}>
      <option value="">Printer: not set</option>
      {row.printer && !row.printerOptions.includes(row.printer) ? (
        <option value={row.printer}>{row.printer}</option>
      ) : null}
      {row.printerOptions.map((name) => (
        <option key={name} value={name}>
          {row.colour && row.printersWithColour.includes(name) ? `${name} · ${row.colour} loaded` : name}
        </option>
      ))}
    </NativeSelect>
  );
}

export default function SubmissionCard({
  row,
  position,
  isFirst,
  isLast,
}: {
  row: BoardRow;
  position?: number;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const approve = useMutation(api.queue.approve);
  const startPrinting = useMutation(api.queue.startPrinting);
  const setPrinter = useMutation(api.queue.setPrinter);
  const markDone = useMutation(api.queue.markDone);
  const moveBack = useMutation(api.queue.moveBack);
  const move = useMutation(api.queue.move);
  const download = useDownloadSubmission();
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectKind, setRejectKind] = useState<"review" | "print_failed">("review");
  const [busy, setBusy] = useState(false);
  const [printerChoice, setPrinterChoice] = useState("");

  const backup = row.status === "submitted" && !row.printRequested;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(`${row.printCode} ${label}`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={cn(
        "rounded-xl bg-card shadow-(--shadow-card) ring-1 ring-foreground/10 transition-opacity",
        backup && "opacity-55 hover:opacity-100"
      )}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-center gap-3 sm:w-32 sm:flex-col sm:items-start">
          {position !== undefined ? (
            <span className="font-mono text-xs text-muted-dim">#{position}</span>
          ) : null}
          <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
            {row.printCode}
          </span>
          {backup ? <Badge variant="outline">Backup file</Badge> : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-heading text-lg font-medium tracking-tight">{row.title}</div>
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">{row.participantUsername}</span>
            <span className="text-muted-foreground">Luma: {row.participantName}</span>
            {row.participantEmail ? (
              <span className="text-muted-dim">{row.participantEmail}</span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-3 rounded-full ring-1 ring-foreground/20"
                style={{ background: swatchFor(row.colour) }}
              />
              {row.colour ?? "Any colour"}
            </span>
            <span>{row.dimensionsMm ? formatDimensions(row.dimensionsMm) : "Size unknown"}</span>
            {row.printer ? (
              <Badge variant="outline">
                <Printer aria-hidden="true" />
                {row.printer}
              </Badge>
            ) : null}
            {row.oversize ? <Badge variant="destructive">Over size limit</Badge> : null}
            <span className="font-mono uppercase">
              {row.kind} · {formatBytes(row.sizeBytes)}
            </span>
            <span>Submitted {formatTime(row._creationTime)}</span>
          </div>
          {row.colour ? (
            row.printersWithColour.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Printers with this colour: {row.printersWithColour.join(", ")}
              </p>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                <TriangleAlert aria-hidden="true" className="size-4" />
                No printer has this colour loaded
              </p>
            )
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Button
              size="sm"
              onClick={() =>
                download(row._id, row.downloadName).catch((err) =>
                  toast.error(errorMessage(err, "Download failed"))
                )
              }
            >
              <Download data-icon="inline-start" />
              Download
            </Button>
            <span className="font-mono text-xs break-all text-muted-foreground">
              {row.downloadName}
            </span>
          </div>
          {row.notes ? (
            <p className="mt-2 rounded-md bg-surface px-2.5 py-1.5 text-sm">{row.notes}</p>
          ) : null}
          {row.status === "rejected" && row.rejectionReason ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-destructive">
              <Badge variant="destructive">
                {row.rejectionKind === "print_failed" ? "Print failed" : "Rejected"}
              </Badge>
              <span>{row.rejectionReason}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:max-w-64 sm:justify-end">
          {row.status === "printing" || row.status === "done" ? (
            <PrinterSelect
              row={row}
              value={row.printer ?? ""}
              disabled={busy}
              onChange={(event) => {
                const printer = event.currentTarget.value;
                void run("printer updated", () =>
                  setPrinter({ id: row._id, printer: printer || undefined })
                );
              }}
            />
          ) : null}
          {row.status === "submitted" ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => run("approved", () => approve({ id: row._id }))}>
                <Check data-icon="inline-start" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setRejectKind("review");
                  setRejecting(true);
                }}
              >
                <X data-icon="inline-start" />
                Reject
              </Button>
            </>
          ) : null}
          {row.status === "queued" ? (
            <>
              <PrinterSelect
                row={row}
                value={printerChoice}
                disabled={busy}
                onChange={(event) => setPrinterChoice(event.currentTarget.value)}
              />
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  run("printing", () => startPrinting({ id: row._id, printer: printerChoice || undefined }))
                }
              >
                <Printer data-icon="inline-start" />
                Start printing
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Move up"
                disabled={busy || isFirst}
                onClick={() => run("moved up", () => move({ id: row._id, direction: "up" }))}
              >
                <ArrowUp />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Move down"
                disabled={busy || isLast}
                onClick={() => run("moved down", () => move({ id: row._id, direction: "down" }))}
              >
                <ArrowDown />
              </Button>
            </>
          ) : null}
          {row.status === "printing" ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => run("done", () => markDone({ id: row._id }))}>
                <Check data-icon="inline-start" />
                Mark done
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setRejectKind("print_failed");
                  setRejecting(true);
                }}
              >
                Print failed
              </Button>
            </>
          ) : null}
          {row.status !== "submitted" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => run("moved back", () => moveBack({ id: row._id }))}
            >
              <Undo2 data-icon="inline-start" />
              {row.status === "rejected" ? "Unreject" : "Move back"}
            </Button>
          ) : null}
          {row.status === "queued" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setRejectKind("review");
                setRejecting(true);
              }}
            >
              <X data-icon="inline-start" />
              Reject
            </Button>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between border-t border-border px-4 py-2 font-mono text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <span className="truncate">{row.downloadName}</span>
        <span className="flex shrink-0 items-center gap-1">
          Preview
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </span>
      </button>
      {expanded && row.fileUrl ? (
        <div className="border-t border-border bg-surface p-2">
          <ModelPreview
            url={row.fileUrl}
            previewUrl={row.previewUrl}
            kind={row.kind}
            colour={swatchFor(row.colour)}
            alt={row.title}
            className="mx-auto max-h-80 max-w-80"
          />
        </div>
      ) : null}

      <RejectDialog
        submissionId={row._id}
        printCode={row.printCode}
        open={rejecting}
        onOpenChange={setRejecting}
        kind={rejectKind}
      />
    </li>
  );
}
