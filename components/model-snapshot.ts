import * as THREE from "three";
import type { Id } from "@/convex/_generated/dataModel";
import type { FileKind } from "@/lib/files";
import { MAX_PREVIEW_BYTES } from "@/lib/preview-image";
import { createModelScene, disposeScene, frameModel, parseModel } from "@/components/model-scene";

const OUTPUT_SIZE = 768;
const RENDER_SIZE = OUTPUT_SIZE * 2;
const TARGET_BYTES = 120 * 1024;

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Couldn't encode preview image"));
    }, type, quality);
  });
}

async function sourceBuffer(source: Blob | ArrayBuffer | string): Promise<ArrayBuffer> {
  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Model download failed (${response.status})`);
    return await response.arrayBuffer();
  }
  return source instanceof Blob ? await source.arrayBuffer() : source;
}

export async function renderModelSnapshot(
  source: Blob | ArrayBuffer | string,
  kind: FileKind,
  colour: string
): Promise<Blob> {
  const { scene, camera, pivot } = createModelScene();
  const webglCanvas = document.createElement("canvas");
  let renderer: THREE.WebGLRenderer | undefined;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: webglCanvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(RENDER_SIZE, RENDER_SIZE, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    frameModel(parseModel(await sourceBuffer(source), kind, colour), pivot, camera);
    renderer.render(scene, camera);

    const output = document.createElement("canvas");
    output.width = OUTPUT_SIZE;
    output.height = OUTPUT_SIZE;
    const context = output.getContext("2d");
    if (!context) throw new Error("Couldn't create preview canvas");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const draw = () => context.drawImage(webglCanvas, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    draw();
    let blob = await canvasBlob(output, "image/webp", 0.85);
    if (blob.type === "image/webp") {
      if (blob.size <= TARGET_BYTES) return blob;
      blob = await canvasBlob(output, "image/webp", 0.7);
      if (blob.type === "image/webp" && blob.size <= TARGET_BYTES) return blob;
      blob = await canvasBlob(output, "image/webp", 0.55);
      if (blob.type === "image/webp" && blob.size <= TARGET_BYTES) return blob;
    }
    const png = await canvasBlob(output, "image/png");
    if (png.size <= TARGET_BYTES) return png;

    scene.background = new THREE.Color("#e5e5e5");
    renderer.render(scene, camera);
    draw();
    blob = await canvasBlob(output, "image/jpeg", 0.85);
    if (blob.size > MAX_PREVIEW_BYTES) throw new Error("Preview image is too large");
    return blob;
  } finally {
    disposeScene(scene);
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}

export async function uploadPreview(
  generateUrl: () => Promise<string>,
  blob: Blob
): Promise<Id<"_storage">> {
  const response = await fetch(await generateUrl(), {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  if (!response.ok) throw new Error("Preview upload failed");
  const result = (await response.json()) as { storageId: Id<"_storage"> };
  return result.storageId;
}
