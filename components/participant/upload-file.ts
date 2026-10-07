import type { Id } from "@/convex/_generated/dataModel";
import { renderModelSnapshot, uploadPreview } from "@/components/model-snapshot";
import { fitsWithin } from "@/lib/dimensions";
import type { Dimensions } from "@/lib/event";
import { fileKindFromName, type FileKind } from "@/lib/files";
import { measureModel } from "@/lib/model-dimensions";

export function formatUploadBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function validateModelFile(file: File, maxFileBytes: number): FileKind {
  const kind = fileKindFromName(file.name);
  if (!kind) throw new Error("Only STL or 3MF files are accepted");
  if (file.size > maxFileBytes) {
    throw new Error(`That file is ${formatUploadBytes(file.size)}. The limit is ${formatUploadBytes(maxFileBytes)}.`);
  }
  return kind;
}

export async function measureUploadFile(file: File, kind: FileKind, maxDimensionsMm: Dimensions) {
  const dimensions = await measureModel(await file.arrayBuffer(), kind);
  return { dimensions, fits: fitsWithin(dimensions, maxDimensionsMm) };
}

export async function uploadModelFile({
  file,
  kind,
  colour,
  generateUploadUrl,
  generatePreviewUploadUrl,
}: {
  file: File;
  kind: FileKind;
  colour: string;
  generateUploadUrl: () => Promise<string>;
  generatePreviewUploadUrl: () => Promise<string>;
}) {
  const snapshot = renderModelSnapshot(file, kind, colour)
    .then((blob) => uploadPreview(generatePreviewUploadUrl, blob))
    .catch(() => undefined);
  const response = await fetch(await generateUploadUrl(), {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error("Upload failed, try again");
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  const previewStorageId = await snapshot;
  return { storageId, previewStorageId };
}
