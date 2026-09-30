import { describe, expect, it } from "vitest";
import { displayNameFrom, downloadFileName, fileKindFromName, formatPrintCode } from "@/lib/files";

describe("files", () => {
  it("builds sortable download names", () => {
    expect(
      downloadFileName({
        printCode: formatPrintCode(7),
        participantName: "Ada Lovelace",
        colour: "Red",
        title: "Rocket Keychain!",
        kind: "3mf",
      })
    ).toBe("KC-007_ada-lovelace_red_rocket-keychain.3mf");
  });

  it("detects allowed kinds", () => {
    expect(fileKindFromName("a.STL")).toBe("stl");
    expect(fileKindFromName("a.3mf")).toBe("3mf");
    expect(fileKindFromName("a.obj")).toBeNull();
  });

  it("shortens display names", () => {
    expect(displayNameFrom("Ada King Lovelace")).toBe("Ada L.");
    expect(displayNameFrom("Cher")).toBe("Cher");
  });
});
