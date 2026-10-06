"use client";

import Image from "next/image";
import { useState } from "react";
import { Download, History, RotateCcw } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useDownloadSubmission, useDownloadSubmissionVersion } from "@/components/admin/download";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type RestoreInfo = { ok: boolean; reason?: string };

function time(ms: number) {
  return new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function HistoryDialog({
  submissionId,
  deleted = false,
  restore,
}: {
  submissionId: Id<"submissions">;
  deleted?: boolean;
  restore?: RestoreInfo;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const data = useQuery(api.history.forSubmission, open ? { id: submissionId } : "skip");
  const restoreVersion = useMutation(api.history.restoreVersion);
  const restoreSubmission = useMutation(api.history.restoreSubmission);
  const download = useDownloadSubmission();
  const downloadVersion = useDownloadSubmissionVersion();

  async function restoreOldVersion(versionId: Id<"submissionVersions">, version: number) {
    setBusy(true);
    try {
      await restoreVersion({ versionId });
      toast.success(`Restored v${version}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't restore version");
    } finally {
      setBusy(false);
    }
  }

  async function restoreDeletedSubmission() {
    setBusy(true);
    try {
      await restoreSubmission({ id: submissionId });
      toast.success("Submission restored");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't restore submission");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <History data-icon="inline-start" />
        History
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {data ? `${data.printCode} · ${data.title}` : "Submission history"}
          </DialogTitle>
          <DialogDescription>
            {data ? `${data.participantUsername} · ${data.participantEmail}` : "Current file, older versions, and audit trail."}
          </DialogDescription>
        </DialogHeader>
        {data === undefined ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : data === null ? (
          <p className="text-sm text-muted-foreground">Submission not found.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {deleted || data.deletedAt ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <p className="text-sm">Deleted {time(data.deletedAt ?? 0)}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="brand"
                  disabled={busy || restore?.ok === false}
                  title={restore?.ok === false ? restore.reason : undefined}
                  onClick={() => void restoreDeletedSubmission()}
                >
                  <RotateCcw data-icon="inline-start" />
                  Restore submission
                </Button>
                {restore?.ok === false ? <p className="w-full text-xs text-muted-foreground">{restore.reason}</p> : null}
              </div>
            ) : null}
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Current file · v{data.current.version}</h3>
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                {data.current.previewUrl ? (
                  <Image
                    src={data.current.previewUrl}
                    alt=""
                    width={96}
                    height={96}
                    unoptimized
                    className="size-20 rounded-md object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{data.current.originalFileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.current.kind.toUpperCase()} · {formatBytes(data.current.sizeBytes)}
                    {data.current.dimensionsMm ? ` · ${data.current.dimensionsMm.x} × ${data.current.dimensionsMm.y} × ${data.current.dimensionsMm.z} mm` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void download(submissionId, data.current.downloadName).catch((error) => toast.error(error.message))}
                >
                  <Download data-icon="inline-start" />
                  Download
                </Button>
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Older versions</h3>
              {data.restoreBlockedReason ? (
                <p className="text-xs text-muted-foreground">{data.restoreBlockedReason}</p>
              ) : null}
              {data.versions.length ? data.versions.map((version) => (
                <div key={version._id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
                  {version.previewUrl ? (
                    <Image
                      src={version.previewUrl}
                      alt=""
                      width={72}
                      height={72}
                      unoptimized
                      className="size-16 rounded-md object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">v{version.version}</span>
                      <Badge variant="outline">{version.why} · {time(version.archivedAt)}</Badge>
                    </div>
                    <p className="truncate text-sm">{version.originalFileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {version.kind.toUpperCase()} · {formatBytes(version.sizeBytes)}
                      {version.dimensionsMm ? ` · ${version.dimensionsMm.x} × ${version.dimensionsMm.y} × ${version.dimensionsMm.z} mm` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void downloadVersion(version._id, version.downloadName).catch((error) => toast.error(error.message))}
                    >
                      <Download data-icon="inline-start" />
                      Download
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={<Button type="button" size="sm" variant="brand" disabled={busy || Boolean(data.restoreBlockedReason)} />}
                      >
                        Restore
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restore v{version.version} as v{data.version + 1}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The current file (v{data.version}) goes into history. Votes and likes reset to 0 and the print needs review again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void restoreOldVersion(version._id, version.version)} disabled={busy}>
                            Restore
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {data.restoreBlockedReason ? (
                    <p className="w-full text-xs text-muted-foreground">{data.restoreBlockedReason}</p>
                  ) : null}
                </div>
              )) : <p className="text-sm text-muted-foreground">No older versions.</p>}
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Audit trail</h3>
              {data.audit.length ? data.audit.map((row) => (
                <div key={row._id} className="flex flex-wrap gap-x-2 text-xs">
                  <time className="text-muted-foreground">{time(row.at)}</time>
                  <span className="font-medium">{row.actor}</span>
                  <span>{row.action}</span>
                  {row.detail ? <span className="text-muted-foreground">{row.detail}</span> : null}
                </div>
              )) : <p className="text-sm text-muted-foreground">No audit events.</p>}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
