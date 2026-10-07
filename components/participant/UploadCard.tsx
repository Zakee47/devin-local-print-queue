"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Ruler, Upload, X } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import ModelViewer from "@/components/ModelViewer";
import SubmissionFields, { type SubmissionDraft } from "@/components/participant/SubmissionFields";
import RoleChoice from "@/components/participant/RoleChoice";
import { measureUploadFile, uploadModelFile, validateModelFile, formatUploadBytes } from "@/components/participant/upload-file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { swatchFor } from "@/lib/colours";
import { formatDimensions } from "@/lib/dimensions";
import { ALLOWED_EXTENSIONS, MAX_SUBMISSIONS_PER_PARTICIPANT, type Dimensions, type Printer } from "@/lib/event";
import type { Role, RoleFile } from "@/lib/roles";
import type { FileKind } from "@/lib/files";
import { cn } from "@/lib/utils";

const EMPTY_DRAFT: SubmissionDraft = { title: "", notes: "", colour: "" };

type Measurement =
  | { state: "measuring" }
  | { state: "ok"; dimensions: Dimensions }
  | { state: "too_big"; dimensions: Dimensions }
  | { state: "error" };

export function formatBytes(bytes: number) {
  return formatUploadBytes(bytes);
}

function titleFromFileName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 60);
}

export default function UploadCard({
  colours,
  printers,
  maxFileBytes,
  maxDimensionsMm,
  slotsLeft,
  active,
  onCompetitionEntry,
  printOnly = false,
}: {
  colours: string[];
  printers: Printer[];
  maxFileBytes: number;
  maxDimensionsMm: Dimensions;
  slotsLeft: number;
  active: RoleFile[];
  onCompetitionEntry: (printCode: string) => boolean;
  printOnly?: boolean;
}) {
  const generateUploadUrl = useMutation(api.submissions.generateUploadUrl);
  const generatePreviewUploadUrl = useMutation(api.submissions.generatePreviewUploadUrl);
  const create = useMutation(api.submissions.create);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ file: File; kind: FileKind; url: string } | null>(null);
  const [draft, setDraft] = useState<SubmissionDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const pickId = useRef(0);

  useEffect(() => () => {
    if (file) URL.revokeObjectURL(file.url);
  }, [file]);

  function reset() {
    pickId.current += 1;
    setFile(null);
    setMeasurement(null);
    setRole(null);
    setDraft(EMPTY_DRAFT);
    if (inputRef.current) inputRef.current.value = "";
  }

  function pick(picked: File | undefined) {
    if (!picked) return;
    let kind: FileKind;
    try {
      kind = validateModelFile(picked, maxFileBytes);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't use that file");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile({ file: picked, kind, url: URL.createObjectURL(picked) });
    setRole(null);
    setDraft((d) => (d.title ? d : { ...d, title: titleFromFileName(picked.name) }));
    void measure(picked, kind);
  }

  async function measure(picked: File, kind: FileKind) {
    const id = ++pickId.current;
    setMeasurement({ state: "measuring" });
    let next: Measurement;
    try {
      const { dimensions, fits } = await measureUploadFile(picked, kind, maxDimensionsMm);
      next = { state: fits ? "ok" : "too_big", dimensions };
    } catch {
      next = { state: "error" };
    }
    if (id === pickId.current) setMeasurement(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !role || !draft.title.trim() || measurement?.state !== "ok") return;
    const { dimensions } = measurement;
    setBusy(true);
    try {
      const uploaded = await uploadModelFile({
        file: file.file,
        kind: file.kind,
        colour: swatchFor(draft.colour),
        generateUploadUrl: () => generateUploadUrl({}),
        generatePreviewUploadUrl: () => generatePreviewUploadUrl({}),
      });
      const result = await create({
        storageId: uploaded.storageId,
        ...(uploaded.previewStorageId ? { previewStorageId: uploaded.previewStorageId } : {}),
        title: draft.title,
        notes: draft.notes || undefined,
        colour: draft.colour || undefined,
        originalFileName: file.file.name,
        dimensionsMm: dimensions,
        role,
      });
      if (!result.ok) throw new Error(result.error);
      if (role === "print") {
        toast.success("Uploaded! The organizers will review it shortly.");
      } else if (!onCompetitionEntry(result.printCode)) {
        toast.success("Uploaded successfully");
      }
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a design</CardTitle>
        <CardDescription>
          STL or 3MF, up to {formatBytes(maxFileBytes)} and {formatDimensions(maxDimensionsMm)}. {slotsLeft} of{" "}
          {MAX_SUBMISSIONS_PER_PARTICIPANT} slots left.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
            className="sr-only"
            id="model-file"
            onChange={(e) => pick(e.target.files?.[0])}
            disabled={busy}
          />
          {file ? (
            <div className="flex flex-col gap-2">
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <ModelViewer url={file.url} kind={file.kind} colour={swatchFor(draft.colour)} className="aspect-4/3" />
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                  {file.file.name} · {formatBytes(file.file.size)}
                  {measurement?.state === "ok" ? ` · ${formatDimensions(measurement.dimensions)}` : null}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={busy}>
                  <X data-icon="inline-start" />
                  Change
                </Button>
              </div>
              {measurement && measurement.state !== "ok" ? (
                <p
                  role={measurement.state === "measuring" ? "status" : "alert"}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    measurement.state === "measuring" ? "text-muted-foreground" : "text-destructive"
                  )}
                >
                  {measurement.state === "measuring" ? (
                    <Spinner aria-hidden="true" />
                  ) : (
                    <Ruler className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  {measurement.state === "measuring"
                    ? "Measuring your model…"
                    : measurement.state === "too_big"
                      ? `Your model is ${formatDimensions(measurement.dimensions)}; the limit is ${formatDimensions(maxDimensionsMm)}`
                      : "We couldn't read that model. Check it's a valid STL or 3MF and try again."}
                </p>
              ) : null}
            </div>
          ) : (
            <label
              htmlFor="model-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-10 text-center transition-colors hover:bg-surface-hover has-focus-visible:outline-2 has-focus-visible:outline-ring"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pick(e.dataTransfer.files[0]);
              }}
            >
              <FileUp className="size-6 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">Choose a .stl or .3mf file</span>
              <span className="text-xs text-muted-foreground">Tap to browse, or drop it here</span>
            </label>
          )}
          {file ? (
            <>
              <SubmissionFields value={draft} onChange={setDraft} colours={colours} printers={printers} disabled={busy} />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Use this file for</p>
                <RoleChoice
                  active={active}
                  targetId={null}
                  value={role}
                  onChange={setRole}
                  disabled={busy}
                  printOnly={printOnly}
                />
              </div>
              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="h-11 w-full text-[15px]"
                disabled={busy || !role || !draft.title.trim() || measurement?.state !== "ok"}
              >
                {busy ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
                {busy ? "Uploading…" : "Submit design"}
              </Button>
            </>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
