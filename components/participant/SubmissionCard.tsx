"use client";

import { useState } from "react";
import { Lock, Pencil, Printer as PrinterIcon, Trash2, Trophy } from "lucide-react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import ModelViewer from "@/components/ModelViewer";
import ModelPreview from "@/components/ModelPreview";
import { renderModelSnapshot, uploadPreview } from "@/components/model-snapshot";
import StatusStepper from "@/components/participant/StatusStepper";
import SubmissionFields, { type SubmissionDraft } from "@/components/participant/SubmissionFields";
import { formatBytes } from "@/components/participant/UploadCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { swatchFor } from "@/lib/colours";
import { formatDimensions } from "@/lib/dimensions";
import type { Printer } from "@/lib/event";
import { cn } from "@/lib/utils";

export type MySubmission = NonNullable<FunctionReturnType<typeof api.submissions.mine>>[number];

function errorMessage(e: unknown) {
  if (!(e instanceof Error)) return "Something went wrong";
  // Convex prefixes server errors with request metadata.
  const match = e.message.match(/Uncaught Error: (.+?)(\n|$)/);
  return match ? match[1] : e.message;
}

function PickRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-muted-foreground [&>svg]:size-4" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SubmissionCard({
  submission: s,
  colours,
  printers,
  showPrintChoice,
  submissionsOpen,
}: {
  submission: MySubmission;
  colours: string[];
  printers: Printer[];
  showPrintChoice: boolean;
  submissionsOpen: boolean;
}) {
  const setPrintRequested = useMutation(api.submissions.setPrintRequested);
  const setDesignEntry = useMutation(api.submissions.setDesignEntry);
  const update = useMutation(api.submissions.update);
  const generatePreviewUploadUrl = useMutation(api.submissions.generatePreviewUploadUrl);
  const remove = useMutation(api.submissions.remove);
  const [editing, setEditing] = useState<SubmissionDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const rejected = s.status === "rejected";
  const liveDesign = s.designEntry && !s.designRemoved;
  const printing = s.printRequested && !rejected;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", (liveDesign || printing) && "ring-2 ring-brand")}>
      <div className="relative border-b border-border bg-surface">
        {s.fileUrl ? (
          editing ? (
            <ModelViewer
              url={s.fileUrl}
              kind={s.kind}
              colour={swatchFor(editing.colour)}
              className="aspect-4/3"
            />
          ) : (
            <ModelPreview
              url={s.fileUrl}
              previewUrl={s.previewUrl}
              kind={s.kind}
              colour={swatchFor(s.colour)}
              alt={s.title}
              className={cn("aspect-4/3", rejected && !liveDesign && "opacity-50 grayscale")}
            />
          )
        ) : (
          <div className="grid aspect-4/3 place-items-center text-xs text-muted-foreground">File unavailable</div>
        )}
        <span className="absolute top-3 left-3 rounded-md bg-background/85 px-2 py-1 font-mono text-xs font-semibold backdrop-blur">
          {s.printCode}
        </span>
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
          {liveDesign ? (
            <span className="flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-xs font-medium text-brand-foreground">
              <Trophy className="size-3" aria-hidden="true" />
              Competition entry
            </span>
          ) : null}
          {printing ? (
            <span className="flex items-center gap-1 rounded-md bg-background/85 px-2 py-1 text-xs font-medium backdrop-blur">
              <PrinterIcon className="size-3" aria-hidden="true" />
              Print request
            </span>
          ) : null}
        </div>
      </div>
      <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
        {editing ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(async () => {
                let previewStorageId;
                if (s.fileUrl && (editing.colour !== (s.colour ?? "") || !s.previewUrl)) {
                  previewStorageId = await renderModelSnapshot(
                    s.fileUrl,
                    s.kind,
                    swatchFor(editing.colour)
                  )
                    .then((blob) =>
                      uploadPreview(() => generatePreviewUploadUrl({}), blob)
                    )
                    .catch(() => undefined);
                }
                await update({
                  id: s._id,
                  title: editing.title,
                  notes: editing.notes || undefined,
                  colour: editing.colour || undefined,
                  ...(previewStorageId ? { previewStorageId } : {}),
                });
              }, "Saved");
              if (ok) setEditing(null);
            }}
          >
            <SubmissionFields
              value={editing}
              onChange={setEditing}
              colours={colours}
              printers={printers}
              disabled={busy}
            />
            <div className="flex gap-2">
              <Button type="submit" variant="brand" size="lg" className="flex-1" disabled={busy || !editing.title.trim()}>
                Save
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-heading text-lg font-semibold">{s.title}</h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2.5 rounded-full border border-border-strong"
                      style={{ backgroundColor: s.colour ? swatchFor(s.colour) : "transparent" }}
                      aria-hidden="true"
                    />
                    {s.colour ?? "Any colour"}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="uppercase">{s.kind}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatBytes(s.sizeBytes)}</span>
                  {s.dimensionsMm ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{formatDimensions(s.dimensionsMm)}</span>
                    </>
                  ) : null}
                </p>
              </div>
              {!s.editable && !rejected ? (
                <Badge variant="secondary" className="gap-1">
                  <Lock aria-hidden="true" />
                  Locked
                </Badge>
              ) : null}
            </div>
            {s.notes ? <p className="text-sm whitespace-pre-line text-muted-foreground">{s.notes}</p> : null}
            <PickRow
              icon={<Trophy />}
              title="Competition entry"
              description="Voted on to win a 3D printer. No staff approval needed."
            >
              {s.designRemoved ? (
                <p role="status" className="text-sm text-destructive">
                  Removed from the competition by the organizers
                  {s.designRemovedReason ? `: ${s.designRemovedReason}` : ""}.
                </p>
              ) : s.designEntry ? (
                <Badge variant="secondary" className="gap-1 text-brand">
                  <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                  Live in voting
                </Badge>
              ) : !rejected && submissionsOpen ? (
                <Button
                  variant="outline"
                  className="h-9 w-fit"
                  disabled={busy}
                  onClick={() =>
                    run(() => setDesignEntry({ submissionId: s._id }), `${s.printCode} is now your competition entry`)
                  }
                >
                  <Trophy data-icon="inline-start" />
                  Enter in competition
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Not entered</p>
              )}
            </PickRow>
            <PickRow
              icon={<PrinterIcon />}
              title="Print request"
              description="Printed for you. Needs staff approval."
            >
              {s.printRequested || s.status !== "submitted" ? (
                <StatusStepper
                  status={s.status}
                  rejectionReason={s.rejectionReason}
                  rejectionKind={s.rejectionKind}
                  queuePosition={s.queuePosition}
                />
              ) : showPrintChoice && s.canChoose && s.editable ? (
                <Button
                  variant="outline"
                  className="h-9 w-fit"
                  disabled={busy}
                  onClick={() => run(() => setPrintRequested({ id: s._id }), `${s.printCode} is now your print request`)}
                >
                  <PrinterIcon data-icon="inline-start" />
                  Request print
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Not requested</p>
              )}
            </PickRow>
            {s.editable ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-10"
                  disabled={busy || !submissionsOpen}
                  onClick={() => setEditing({ title: s.title, notes: s.notes ?? "", colour: s.colour ?? "" })}
                >
                  <Pencil data-icon="inline-start" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="lg" className="h-10 text-muted-foreground" disabled={busy} />}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {s.title}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes {s.printCode} and its file. You can upload another design afterwards.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => run(() => remove({ id: s._id }), "Deleted")}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
