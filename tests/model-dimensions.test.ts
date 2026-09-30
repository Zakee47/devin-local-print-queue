import { describe, expect, test } from "vitest";
import { strToU8, zipSync } from "three/examples/jsm/libs/fflate.module.js";
import { measureModel, mmPerUnit, threeMFUnit } from "../lib/model-dimensions";

function box(x: number, y: number, z: number) {
  const corners = [
    [0, 0, 0],
    [x, 0, 0],
    [x, y, 0],
    [0, y, z],
  ];
  const facets = [
    [0, 1, 2],
    [0, 2, 3],
    [1, 2, 3],
  ];
  const body = facets
    .map(
      (f) =>
        `facet normal 0 0 1\n outer loop\n${f.map((i) => `  vertex ${corners[i].join(" ")}`).join("\n")}\n endloop\nendfacet`
    )
    .join("\n");
  return new TextEncoder().encode(`solid test\n${body}\nendsolid test\n`).buffer as ArrayBuffer;
}

function threeMF(unit?: string, path = "3D/3dmodel.model") {
  const unitAttr = unit ? ` unit="${unit}"` : "";
  const files: Record<string, Uint8Array> = {
    [path]: strToU8(`<?xml version="1.0"?><model${unitAttr} xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"></model>`),
    "_rels/.rels": strToU8(
      `<Relationships><Relationship Target="/${path}" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`
    ),
  };
  return zipSync(files).buffer as ArrayBuffer;
}

describe("measureModel", () => {
  test("measures an ASCII STL bounding box in millimetres", async () => {
    expect(await measureModel(box(27, 51, 40), "stl")).toEqual({ x: 27, y: 51, z: 40 });
    const flat = await measureModel(box(38.5, 50, 4.5), "stl");
    expect(flat.x).toBeCloseTo(38.5);
    expect(flat.y).toBeCloseTo(50);
    expect(flat.z).toBeCloseTo(4.5);
  });

  test("throws for an STL with no geometry", async () => {
    await expect(measureModel(box(0, 0, 0), "stl")).rejects.toThrow(/geometry/);
  });
});

describe("3MF units", () => {
  test("reads the root model's unit, defaulting to millimetres", () => {
    expect(threeMFUnit(threeMF("inch"))).toBe("inch");
    expect(threeMFUnit(threeMF("centimeter", "3D/Objects/part.model"))).toBe("centimeter");
    expect(threeMFUnit(threeMF())).toBeNull();
    expect(mmPerUnit(null)).toBe(1);
    expect(mmPerUnit("millimeter")).toBe(1);
    expect(mmPerUnit("inch")).toBe(25.4);
    expect(mmPerUnit("meter")).toBe(1000);
    expect(mmPerUnit("micron")).toBe(0.001);
  });
});
