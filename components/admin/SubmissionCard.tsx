"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  Printer,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { swatchFor } from "@/lib/colours";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import RejectDialog from "@/components/admin/RejectDialog";
import { useDownloadSubmission } from "@/components/admin/download";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), { ssr: false });

export type BoardRow = FunctionReturnType<typeof api.queue.board>[number];

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
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
  const markDone = useMutation(api.queue.markDone);
  const moveBack = useMutation(api.queue.moveBack);
  const move = useMutation(api.queue.move);
  const download = useDownloadSubmission();
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

  const backup = row.status === "submitted" && !row.printRequested;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(`${row.printCode} ${label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : "Failed");
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
          <div className="truncate text-sm text-muted-foreground">
            {row.participantName} · <span className="text-muted-dim">{row.participantEmail}</span>
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
            <span className="font-mono uppercase">
              {row.kind} · {formatBytes(row.sizeBytes)}
            </span>
            <span>Submitted {formatTime(row._creationTime)}</span>
          </div>
          {row.notes ? (
            <p className="mt-2 rounded-md bg-surface px-2.5 py-1.5 text-sm">{row.notes}</p>
          ) : null}
          {row.status === "rejected" && row.rejectionReason ? (
            <p className="mt-2 text-sm text-destructive">Rejected: {row.rejectionReason}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:max-w-64 sm:justify-end">
          {row.status === "submitted" ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => run("approved", () => approve({ id: row._id }))}>
                <Check data-icon="inline-start" />
                Approve
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => setRejecting(true)}>
                <X data-icon="inline-start" />
                Reject
              </Button>
            </>
          ) : null}
          {row.status === "queued" ? (
            <>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run("printing", () => startPrinting({ id: row._id }))}
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
            <Button size="sm" disabled={busy} onClick={() => run("done", () => markDone({ id: row._id }))}>
              <Check data-icon="inline-start" />
              Mark done
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              download(row._id, row.downloadName).catch((err) =>
                toast.error(err instanceof Error ? err.message : "Download failed")
              )
            }
          >
            <Download data-icon="inline-start" />
            Download
          </Button>
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
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(true)}>
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
          <ModelViewer url={row.fileUrl} kind={row.kind} colour={swatchFor(row.colour)} className="mx-auto max-h-80 max-w-80" />
        </div>
      ) : null}

      <RejectDialog
        submissionId={row._id}
        printCode={row.printCode}
        open={rejecting}
        onOpenChange={setRejecting}
      />
    </li>
  );
}
