import { describe, expect, test } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import {
  ANY_COLOUR, NOT_ASSIGNED, applyFilters, beforeIdAfterDrop, bucketOf,
  optionCounts, partitionPrinters, sortBuckets, splitDone, type FilterPill, type QueueViewRow,
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
