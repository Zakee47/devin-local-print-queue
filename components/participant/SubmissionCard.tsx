"use client";

import { useRef, useState } from "react";
import { Pencil, Printer as PrinterIcon, Trash2, Trophy } from "lucide-react";
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
import RoleChoice from "@/components/participant/RoleChoice";
import { measureUploadFile, uploadModelFile, validateModelFile } from "@/components/participant/upload-file";
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
import { type Role, type RoleFile, roleOf } from "@/lib/roles";
import { ALLOWED_EXTENSIONS, type Dimensions } from "@/lib/event";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

export type MySubmission = NonNullable<FunctionReturnType<typeof api.submissions.mine>>[number];

function errorMessage(e: unknown) {
  if (!(e instanceof Error)) return "Something went wrong";
  // Convex prefixes server errors with request metadata.
  const match = e.message.match(/Uncaught Error: (.+?)(\n|$)/);
  return match ? match[1] : e.message;
}

export default function SubmissionCard({
  submission: s,
  colours,
  printers,
  submissionsOpen,
  votingOpen,
  votingNotOpenYet,
  onCompetitionEntry,
  active,
  maxFileBytes,
  maxDimensionsMm,
}: {
  submission: MySubmission;
  colours: string[];
  printers: Printer[];
  submissionsOpen: boolean;
  votingOpen: boolean;
  votingNotOpenYet: boolean;
  onCompetitionEntry: (printCode: string) => boolean;
  active: RoleFile[];
  maxFileBytes: number;
  maxDimensionsMm: Dimensions;
}) {
  const setRoles = useMutation(api.submissions.setRoles);
  const update = useMutation(api.submissions.update);
  const generatePreviewUploadUrl = useMutation(api.submissions.generatePreviewUploadUrl);
  const generateUploadUrl = useMutation(api.submissions.generateUploadUrl);
  const replaceFile = useMutation(api.submissions.replaceFile);
  const remove = useMutation(api.submissions.remove);
  const [editing, setEditing] = useState<SubmissionDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [replacement, setReplacement] = useState<{ file: File; kind: "stl" | "3mf"; dimensions: Dimensions } | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const currentRole = roleOf({ vote: s.vote, print: s.print });
  const roleKey = `${s._id}:${s.vote}:${s.print}`;
  const [roleSelection, setRoleSelection] = useState<{ key: string; role: Role | null }>({
    key: roleKey,
    role: currentRole,
  });
  const selectedRole = roleSelection.key === roleKey ? roleSelection.role : currentRole;

  function selectRole(role: Role | null) {
    setRoleSelection({ key: roleKey, role });
  }

  const rejected = s.status === "rejected";
  const liveDesign = s.vote && !s.designRemoved;
  const printing = s.print;

  function deletePromotion() {
    const other = active.find((file) => file.id !== s._id);
    if (!other) return "";
    const roles = [
      ...(s.vote && !other.vote && !other.designRemoved ? ["Vote"] : []),
      ...(s.print && !other.print && other.status === "submitted" ? ["Print"] : []),
    ];
    return roles.length ? `${other.printCode} takes over ${roles.join(" and ")}.` : "";
  }

  async function chooseReplacement(file: File | undefined) {
    if (!file) return;
    try {
      const kind = validateModelFile(file, maxFileBytes);
      const { dimensions, fits } = await measureUploadFile(file, kind, maxDimensionsMm);
      if (!fits) {
        throw new Error(
          `Your model is ${formatDimensions(dimensions)}; the limit is ${formatDimensions(maxDimensionsMm)}`
        );
      }
      setReplacement({ file, kind, dimensions });
      setReplaceDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't use that file");
    } finally {
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  }

  async function submitReplacement() {
    if (!replacement) return;
    setBusy(true);
    try {
      const uploaded = await uploadModelFile({
        file: replacement.file,
        kind: replacement.kind,
        colour: swatchFor(s.colour),
        generateUploadUrl: () => generateUploadUrl({ replaceId: s._id }),
        generatePreviewUploadUrl: () => generatePreviewUploadUrl({}),
      });
      const result = await replaceFile({
        id: s._id,
        storageId: uploaded.storageId,
        ...(uploaded.previewStorageId ? { previewStorageId: uploaded.previewStorageId } : {}),
        originalFileName: replacement.file.name,
        dimensionsMm: replacement.dimensions,
      });
      if (!result.ok) throw new Error(result.error);
      toast.success(`${s.printCode} replaced with version ${s.version + 1}`);
      setReplacement(null);
      setReplaceDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? errorMessage(error) : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<unknown>, success: string, afterSuccess?: () => void) {
    setBusy(true);
    try {
      await action();
      if (afterSuccess) afterSuccess();
      else toast.success(success);
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
          {s.version > 1 ? <span className="ml-2">v{s.version}</span> : null}
        </span>
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
          {s.vote || s.designRemoved ? (
            <Badge variant={s.designRemoved ? "outline" : "default"}>
              <Trophy data-icon="inline-start" aria-hidden="true" />
              {s.designRemoved
                ? "Removed from voting"
                : votingOpen
                  ? "Live in voting"
                  : votingNotOpenYet
                    ? "In voting · opens soon"
                    : "Voting closed"}
            </Badge>
          ) : null}
          {printing ? (
            <Badge variant="outline">
              <PrinterIcon data-icon="inline-start" aria-hidden="true" />
              Print · {s.status === "queued" ? `Queued #${s.queuePosition ?? "—"}` : s.status === "submitted" ? "Needs approval" : s.status}
            </Badge>
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
            </div>
            {s.notes ? <p className="text-sm whitespace-pre-line text-muted-foreground">{s.notes}</p> : null}
              {s.print || s.status !== "submitted" ? (
                <StatusStepper
                  status={s.status}
                  rejectionReason={s.rejectionReason}
                  rejectionKind={s.rejectionKind}
                  queuePosition={s.queuePosition}
                />
            ) : null}
            {s.designRemoved && s.designRemovedReason ? (
              <p className="text-sm text-destructive">Removed from voting: {s.designRemovedReason}</p>
            ) : null}
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Use this file for</p>
              {s.changeable && s.active ? (
                <>
                  <RoleChoice
                    active={active}
                    targetId={s._id}
                    value={selectedRole}
                    onChange={selectRole}
                    disabled={busy}
                  />
                  {selectedRole !== currentRole ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="brand"
                        size="sm"
                        disabled={busy || !selectedRole}
                        onClick={() => {
                          if (!selectedRole) return;
                          const addsVote = !s.vote && selectedRole !== "print";
                          void run(
                            () => setRoles({ id: s._id, role: selectedRole }),
                            "Role updated",
                            addsVote
                              ? () => {
                                  if (!onCompetitionEntry(s.printCode)) toast.success("Role updated");
                                }
                              : undefined
                          );
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => selectRole(currentRole)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {currentRole === "both" ? "Vote and Print" : currentRole ?? "No role"}
                  {s.lockedReason ? ` · ${s.lockedReason}` : ""}
                </p>
              )}
            </div>
            {s.changeable ? (
              <div className="flex flex-wrap gap-2">
                {s.editable ? (
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
                ) : null}
                {s.active ? (
                  <>
                    <input
                      ref={replaceInputRef}
                      type="file"
                      accept={ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(",")}
                      className="sr-only"
                      onChange={(event) => void chooseReplacement(event.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-10"
                      disabled={busy}
                      onClick={() => replaceInputRef.current?.click()}
                    >
                      Replace file
                    </Button>
                  </>
                ) : null}
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="lg" className="h-10 text-muted-foreground" disabled={busy} />}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {s.printCode}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        <span className="block">You can upload another design afterwards.</span>
                        {s.vote ? <span className="block">Its votes stop counting.</span> : null}
                        {s.print && s.status === "queued" ? <span className="block">It leaves the print queue.</span> : null}
                        {deletePromotion() ? <span className="block">{deletePromotion()}</span> : null}
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
            <AlertDialog open={replaceDialogOpen} onOpenChange={(open) => !busy && setReplaceDialogOpen(open)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Replace {s.printCode}&apos;s file?</AlertDialogTitle>
                  <AlertDialogDescription>
                    <span className="block">
                      Keeps {s.printCode} and its title. {replacement?.file.name} becomes version {s.version + 1}.
                    </span>
                    {s.vote ? (
                      <span className="block">Its votes and likes reset to 0 and voters get their votes back.</span>
                    ) : null}
                    {s.print && s.status === "queued" ? (
                      <span className="block">It leaves the print queue and needs staff approval again.</span>
                    ) : s.print ? (
                      <span className="block">Staff will review the new file.</span>
                    ) : null}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={(event) => { event.preventDefault(); void submitReplacement(); }} disabled={busy || !replacement}>
                    {busy ? <Spinner data-icon="inline-start" /> : null}
                    Replace file
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
