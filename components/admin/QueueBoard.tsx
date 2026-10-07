"use client";

import { useState } from "react";
import { Download, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SubmissionCard, { type BoardRow } from "@/components/admin/SubmissionCard";
import HistoryDialog from "@/components/admin/HistoryDialog";
import { useDownloadSubmission } from "@/components/admin/download";
import { errorMessage } from "@/lib/errors";

type Column = "review" | "queued" | "printing" | "done" | "rejected";

function columns(rows: BoardRow[]): Record<Column, BoardRow[]> {
  const byTime = (a: BoardRow, b: BoardRow) => a._creationTime - b._creationTime;
  const of = (status: BoardRow["status"]) => rows.filter((r) => r.status === status);
  return {
    review: of("submitted").sort(
      (a, b) => Number(b.printRequested) - Number(a.printRequested) || byTime(a, b)
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
  const download = useDownloadSubmission();
  const [downloading, setDownloading] = useState(false);

  if (rows === undefined || settings === undefined || role === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-96 rounded-lg" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    );
  }

  const cols = columns(rows);
  const printerGroups = printingGroups(
    cols.printing,
    settings.printers.map(({ name }) => name)
  );

  async function downloadAllQueued() {
    setDownloading(true);
    try {
      for (const row of cols.queued) {
        await download(row._id, row.downloadName);
        await new Promise((r) => setTimeout(r, 400));
      }
      toast.success(`Downloaded ${cols.queued.length} files`);
    } catch (err) {
      toast.error(errorMessage(err, "Download failed"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Tabs defaultValue="review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="flex-wrap group-data-horizontal/tabs:h-auto">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="px-2.5">
                {tab.label}
                <span className="font-mono text-xs text-muted-dim tabular-nums">
                  {cols[tab.value].length}
                </span>
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
          disabled={downloading || cols.queued.length === 0}
          onClick={downloadAllQueued}
        >
          <Download data-icon="inline-start" />
          {downloading ? "Downloading..." : `Download all queued (${cols.queued.length})`}
        </Button>
      </div>
      {withdrawals?.length ? (
        <Alert className="mt-4">
          <AlertTitle>Changed by participants</AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {withdrawals.map((row) => (
                <li key={row._id}>
                  <span className="font-mono">{row.printCode}</span> {row.title} · {row.participantUsername} ·{" "}
                  {row.detail} · {new Date(row.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4">
          {cols[tab.value].length === 0 ? (
            <Empty className="border border-dashed border-border-strong py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox />
                </EmptyMedia>
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
                  <ul className="flex flex-col gap-3">
                    {groupRows.map((row) => (
                      <SubmissionCard key={row._id} row={row} isOwner={isOwner} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {cols[tab.value].map((row, i, list) => (
                <SubmissionCard
                  key={row._id}
                  row={row}
                  position={tab.value === "queued" ? i + 1 : undefined}
                  isFirst={i === 0}
                  isLast={i === list.length - 1}
                  isOwner={isOwner}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
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
                  {!row.restore.ok ? (
                    <p className="w-full text-right text-xs text-muted-foreground">{row.restore.reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
