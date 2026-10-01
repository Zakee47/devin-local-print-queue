import { describe, expect, test } from "vitest";
import { toCsv } from "../lib/csv";
import {
  EXPORT_CSV_HEADERS,
  exportCsvName,
  exportCsvRows,
  exportFileStamp,
  exportZipName,
  type ExportRow,
} from "../lib/export";

const row: ExportRow = {
  id: "abc123",
  downloadName: "KC-001_ada_red_rocket.stl",
  printCode: "KC-001",
  title: 'Rocket "XL", v2',
  username: "Ada L.",
  name: "Ada Lovelace",
  email: "ada@example.com",
  colour: "Red",
  status: "queued",
  printer: "Creality",
  printRequested: true,
  likes: 3,
  votes: 1,
  rejectionReason: "",
  createdAt: new Date("2026-10-01T19:35:00Z").getTime(),
};

describe("exportCsvRows", () => {
  test("header order and value formatting", () => {
    const [header, data] = exportCsvRows([row]);
    expect(header).toEqual(EXPORT_CSV_HEADERS);
    expect(header).toEqual([
      "printCode",
      "title",
      "username",
      "name",
      "email",
      "colour",
      "status",
      "printer",
      "printRequested",
      "likes",
      "votes",
      "rejectionReason",
      "createdAt",
    ]);
    expect(data).toEqual([
      "KC-001",
      'Rocket "XL", v2',
      "Ada L.",
      "Ada Lovelace",
      "ada@example.com",
      "Red",
      "queued",
      "Creality",
      "true",
      "3",
      "1",
      "",
      "2026-10-01T19:35:00.000Z",
    ]);
  });

  test("false booleans render as 'false'", () => {
    const [, data] = exportCsvRows([{ ...row, printRequested: false }]);
    expect(data[8]).toBe("false");
  });
});

describe("toCsv", () => {
  test("quotes fields containing commas, quotes and newlines", () => {
    expect(toCsv([["a,b", 'say "hi"', "line\nbreak", "plain"]])).toBe(
      '"a,b","say ""hi""","line\nbreak",plain'
    );
    expect(toCsv([["x"], ["y", "z"]])).toBe("x\r\ny,z");
  });
});

describe("export file names", () => {
  test("local-time stamp and names", () => {
    const date = new Date(2026, 9, 1, 19, 35);
    expect(exportFileStamp(date)).toBe("2026-10-01-1935");
    expect(exportZipName(date)).toBe("keychain-submissions-2026-10-01-1935.zip");
    expect(exportCsvName(date)).toBe("keychain-submissions-2026-10-01-1935.csv");
  });
});
