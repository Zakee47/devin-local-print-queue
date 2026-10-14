import { describe, expect, test } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import {
  ANY_COLOUR, NOT_ASSIGNED, applyFilters, beforeIdAfterDrop, bucketOf, highlightRanges,
  matchesSearch, normalizeSearch, optionCounts, partitionPrinters, searchFields,
  searchSuggestions, sortBuckets, splitDone, type FilterPill, type QueueViewRow, type SearchableRow,
} from "../components/admin/queue-view";

function row(id: string, patch: Partial<QueueViewRow> = {}): QueueViewRow {
  return {
    _id: id as Id<"submissions">,
    _creationTime: 1,
    status: "submitted",
    printRequested: true,
    participantPrint: null,
    ...patch,
  };
}

function searchableRow(id: string, patch: Partial<SearchableRow> = {}): SearchableRow {
  return {
    ...row(id),
    printCode: "KC-025",
    title: "Gold keychain",
    participantUsername: "sam",
    participantName: "Sam Example",
    downloadName: "KC-025_sam_gold_keychain.stl",
    colour: "Gold",
    printer: "Muon 1",
    notes: "needs support",
    rejectionReason: "bad support",
    ...patch,
  };
}

describe("queue view buckets", () => {
  test("maps lifecycle states, withdrawn rows, and vote-only approval", () => {
    expect(bucketOf(row("review"))).toBe("review");
    expect(bucketOf(row("withdrawn", { printRequested: false, participantNotice: { kind: "withdrawn", at: 2 } }))).toBe("withdrawn");
    expect(bucketOf(row("re-requested", { printRequested: true, participantNotice: { kind: "withdrawn", at: 3 } }))).toBe("review");
    expect(bucketOf(row("vote", { printRequested: false, votingApprovedAt: 4 }))).toBe("done");
    expect(bucketOf(row("queued", { status: "queued" }))).toBe("queued");
    expect(bucketOf(row("printing", { status: "printing" }))).toBe("printing");
    expect(bucketOf(row("done", { status: "done" }))).toBe("done");
    expect(bucketOf(row("rejected", { status: "rejected" }))).toBe("rejected");
    expect(bucketOf(row("deleted", { deletedAt: 5 }))).toBe("deleted");
  });

  test("sorts Done and Withdrawn newest first", () => {
    const buckets = sortBuckets([
      row("old", { status: "done", doneAt: 1 }),
      row("new", { printRequested: false, votingApprovedAt: 5 }),
      row("withdrawn-old", { printRequested: false, participantNotice: { kind: "withdrawn", at: 2 } }),
      row("withdrawn-new", { printRequested: false, participantNotice: { kind: "withdrawn", at: 8 } }),
    ]);
    expect(buckets.done.map((r) => r._id)).toEqual(["new", "old"]);
    expect(buckets.withdrawn.map((r) => r._id)).toEqual(["withdrawn-new", "withdrawn-old"]);
  });
});

describe("Done split", () => {
  test("separates printed rows from vote-only designs approved for voting, keeping order", () => {
    const { done } = sortBuckets([
      row("printed-old", { status: "done", doneAt: 1 }),
      row("vote-new", { printRequested: false, votingApprovedAt: 6 }),
      row("printed-new", { status: "done", doneAt: 5 }),
      row("vote-old", { printRequested: false, votingApprovedAt: 2 }),
    ]);
    const groups = splitDone(done);
    expect(groups.printed.map((r) => r._id)).toEqual(["printed-new", "printed-old"]);
    expect(groups.votingOnly.map((r) => r._id)).toEqual(["vote-new", "vote-old"]);
  });
});

describe("queue view filters", () => {
  const rows = [
    row("gold-a", { colour: "Gold", printer: "Muon 1" }),
    row("gold-b", { colour: "Gold", printer: "Creality" }),
    row("blue", { colour: "Sky Blue" }),
    row("any", { printer: "Creality" }),
  ];

  test("uses OR within a pill and AND between pills, including Any colour and Not assigned", () => {
    const pills: FilterPill[] = [
      { id: 1, dimension: "colour", values: ["Gold", "Sky Blue"] },
      { id: 2, dimension: "printer", values: ["Creality", NOT_ASSIGNED] },
    ];
    expect(applyFilters(rows, pills).map((r) => r._id)).toEqual(["gold-b", "blue"]);
    expect(applyFilters(rows, [{ id: 1, dimension: "colour", values: [ANY_COLOUR] }]).map((r) => r._id)).toEqual(["any"]);
  });

  test("option counts apply only earlier pills", () => {
    const pills: FilterPill[] = [
      { id: 1, dimension: "colour", values: ["Gold"] },
      { id: 2, dimension: "printer", values: ["Creality"] },
    ];
    expect(optionCounts(rows, pills, 1, "printer", [NOT_ASSIGNED, "Muon 1", "Creality"])).toEqual({
      [NOT_ASSIGNED]: 0,
      "Muon 1": 1,
      Creality: 1,
    });
  });
});

describe("queue search", () => {
  test("normalizes separators and matches codes, including trailing digits", () => {
    const item = searchableRow("code");
    expect(normalizeSearch("Muon_1 · Sky Blue.")).toBe("muon1skyblue");
    for (const query of ["KC-025", "kc025", "25", "025", "2"]) {
      expect(matchesSearch(item, query), query).toBe(true);
    }
  });

  test("matches participant, title, file, colour, printer, notes, and rejection reason case-insensitively", () => {
    const item = searchableRow("fields");
    for (const query of ["sam", "example", "keychain", "KC-025_sam_gold_keychain.stl", "gold", "muon 1", "needs support", "bad support"]) {
      expect(matchesSearch(item, query), query).toBe(true);
    }
  });

  test("matches normalized colour and printer separators and fallback labels", () => {
    const item = searchableRow("separators", { colour: "Sky Blue", printer: "Muon 1" });
    expect(matchesSearch(item, "sky blue")).toBe(true);
    expect(matchesSearch(item, "skyblue")).toBe(true);
    expect(matchesSearch(item, "sky-blue")).toBe(true);
    expect(matchesSearch(item, "muon_1")).toBe(true);

    const unassigned = searchableRow("unassigned", { colour: undefined, printer: undefined });
    expect(searchFields(unassigned)).toContain("Any colour");
    expect(searchFields(unassigned)).toContain("Not assigned");
    expect(matchesSearch(unassigned, "any colour")).toBe(true);
    expect(matchesSearch(unassigned, "not assigned")).toBe(true);
  });

  test("empty normalized queries match all and non-matches stay false", () => {
    const item = searchableRow("empty-query");
    expect(matchesSearch(item, "")).toBe(true);
    expect(matchesSearch(item, "  · _-.  ")).toBe(true);
    expect(matchesSearch(item, "unrelated phrase")).toBe(false);
    expect(searchFields(searchableRow("empty-fields", { notes: "", rejectionReason: "" }))).not.toContain("");
  });

  test("combines search with the active colour pill", () => {
    const rows = [
      searchableRow("gold-sam", { colour: "Gold", participantUsername: "sam" }),
      searchableRow("gold-ada", {
        colour: "Gold",
        participantUsername: "ada",
        participantName: "Ada Example",
        downloadName: "KC-025_ada_gold_keychain.stl",
      }),
      searchableRow("blue-sam", { colour: "Sky Blue", participantUsername: "sam" }),
    ];
    const gold: FilterPill[] = [{ id: 1, dimension: "colour", values: ["Gold"] }];
    expect(applyFilters(rows, gold).filter((item) => matchesSearch(item, "sam")).map((item) => item._id)).toEqual(["gold-sam"]);
  });
});

describe("search highlight ranges", () => {
  test("maps separator-free matches to their original text ranges", () => {
    expect(highlightRanges("Sky Blue", "skyb")).toEqual([[0, 5]]);
  });

  test("returns multiple non-overlapping matches and no ranges for an empty query", () => {
    expect(highlightRanges("Gold gold GOLD", "gold")).toEqual([[0, 4], [5, 9], [10, 14]]);
    expect(highlightRanges("Sky Blue", " · _-. ")).toEqual([]);
  });
});

describe("quick filter suggestions", () => {
  const rows = [
    row("gold-muon", { colour: "Gold", printer: "Muon 1" }),
    row("gold-creality", { colour: "Gold", printer: "Creality" }),
    row("blue-muon", { colour: "Sky Blue", printer: "Muon 2" }),
    row("any-creality", { printer: "Creality" }),
    row("unassigned", { colour: "Gold" }),
  ];

  test("returns matching colour and printer options with counts and colours first", () => {
    expect(searchSuggestions(rows, "gold", [], ["Gold"], ["Gold printer"])).toEqual([
      { dimension: "colour", value: "Gold", count: 3 },
      { dimension: "printer", value: "Gold printer", count: 0 },
    ]);
    expect(searchSuggestions(rows, "muon", [], ["Gold"], ["Muon 1", "Muon 2"])).toEqual([
      { dimension: "printer", value: "Muon 1", count: 1 },
      { dimension: "printer", value: "Muon 2", count: 1 },
    ]);
  });

  test("matches the Any colour and Not assigned labels and excludes existing values case-insensitively", () => {
    expect(searchSuggestions(rows, "any", [], [], [])).toEqual([
      { dimension: "colour", value: ANY_COLOUR, count: 1 },
    ]);
    expect(searchSuggestions(rows, "not", [], [], [])).toEqual([
      { dimension: "printer", value: NOT_ASSIGNED, count: 1 },
    ]);
    expect(searchSuggestions(rows, "gold", [{ id: 1, dimension: "colour", values: ["gOlD"] }], ["Gold"], [])).toEqual([]);
  });

  test("returns no suggestions for an empty normalized query and caps results at six in candidate order", () => {
    expect(searchSuggestions(rows, "  · _-. ", [], ["Gold"], ["Muon 1"])).toEqual([]);
    const suggestions = searchSuggestions(rows, "o", [], ["Gold", "Rose", "Coral", "Indigo", "Olive", "Bronze", "Honey"], ["Muon 1"]);
    expect(suggestions).toHaveLength(6);
    expect(suggestions.every((suggestion) => suggestion.dimension === "colour")).toBe(true);
    expect(suggestions.map(({ value }) => value)).toEqual([ANY_COLOUR, "Gold", "Rose", "Coral", "Indigo", "Olive"]);
  });
});

describe("partitionPrinters", () => {
  const inService = [{ name: "Muon 1" }, { name: "Creality" }, { name: "Ultimaker" }];

  test("Any colour puts every in-service printer in other", () => {
    expect(partitionPrinters(inService, ["Muon 1", "Creality", "Ultimaker"], undefined)).toEqual({
      matching: [],
      other: ["Muon 1", "Creality", "Ultimaker"],
    });
    expect(partitionPrinters(inService, inService.map((p) => p.name), "")).toEqual({
      matching: [],
      other: ["Muon 1", "Creality", "Ultimaker"],
    });
  });

  test("a colour splits matching from other", () => {
    expect(partitionPrinters(inService, ["muon 1"], "Gold")).toEqual({
      matching: ["Muon 1"],
      other: ["Creality", "Ultimaker"],
    });
  });

  test("paused printers are already excluded by the in-service list", () => {
    const available = inService.filter(({ name }) => name !== "Ultimaker");
    expect(partitionPrinters(available, ["Muon 1"], "Gold")).toEqual({
      matching: ["Muon 1"],
      other: ["Creality"],
    });
    expect(partitionPrinters(available, available.map((p) => p.name), undefined)).toEqual({
      matching: [],
      other: ["Muon 1", "Creality"],
    });
  });
});

test("filtered drag drop uses visible successor or full-order row after the last visible card", () => {
  const id = (value: string) => value as Id<"submissions">;
  const full = ["a", "hidden", "b", "c"].map(id);
  const visible = ["a", "b", "c"].map(id);
  expect(beforeIdAfterDrop(full, visible, id("c"), id("a"))).toBe(id("a"));
  expect(beforeIdAfterDrop(full, visible, id("a"), id("c"))).toBeUndefined();
  expect(beforeIdAfterDrop(["a", "hidden", "b", "c", "tail"].map(id), visible, id("a"), id("c"))).toBe(id("tail"));
  expect(beforeIdAfterDrop(["a", "b"].map(id), ["a", "b"].map(id), id("a"), id("b"))).toBeUndefined();
});
