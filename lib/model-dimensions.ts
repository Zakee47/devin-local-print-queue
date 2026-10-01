import { Box3, Mesh, Vector3, type Object3D } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { strFromU8, unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import type { Dimensions } from "./event";

// Millimetres per unit, per the 3MF core spec's `unit` attribute.
const MM_PER_UNIT: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

export function mmPerUnit(unit: string | null | undefined): number {
  return MM_PER_UNIT[unit?.trim().toLowerCase() ?? ""] ?? 1;
}

export function objectDimensions(object: Object3D, scale = 1): Dimensions {
  object.updateMatrixWorld(true);
  const size = new Box3().setFromObject(object).getSize(new Vector3());
  return { x: size.x * scale, y: size.y * scale, z: size.z * scale };
}

// The root model part is named by the package relationships, falling back to
// the conventional 3D/3dmodel.model.
export function threeMFUnit(buffer: ArrayBuffer): string | null {
  const files = unzipSync(new Uint8Array(buffer));
  const rels = files["_rels/.rels"] ? strFromU8(files["_rels/.rels"]) : "";
  const target = rels.match(/Target="\/?([^"]+\.model)"/i)?.[1];
  const modelPath =
    (target && files[target] ? target : undefined) ??
    Object.keys(files).find((name) => /^3D\/.*\.model$/i.test(name));
  if (!modelPath) return null;
  const tag = strFromU8(files[modelPath]).match(/<(?:\w+:)?model\b[^>]*>/)?.[0];
  return tag?.match(/\bunit\s*=\s*["']([^"']+)["']/)?.[1] ?? null;
}

function measure(buffer: ArrayBuffer, kind: "stl" | "3mf"): Dimensions {
  if (kind === "stl") {
    const geometry = new STLLoader().parse(buffer);
    try {
      return objectDimensions(new Mesh(geometry));
    } finally {
      geometry.dispose();
    }
  }
  const group = new ThreeMFLoader().parse(buffer);
  return objectDimensions(group, mmPerUnit(threeMFUnit(buffer)));
}

export async function measureModel(buffer: ArrayBuffer, kind: "stl" | "3mf"): Promise<Dimensions> {
  const dimensions = measure(buffer, kind);
  const values = [dimensions.x, dimensions.y, dimensions.z];
  if (values.some((value) => !Number.isFinite(value)) || values.every((value) => value === 0)) {
    throw new Error("Couldn't find any geometry in that model");
  }
  return dimensions;
}
