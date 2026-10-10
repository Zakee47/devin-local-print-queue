import { describe, expect, test } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import {
  ANY_COLOUR, NOT_ASSIGNED, applyFilters, beforeIdAfterDrop, bucketOf,
  optionCounts, sortBuckets, type FilterPill, type QueueViewRow,
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

test("filtered drag drop uses visible successor or full-order row after the last visible card", () => {
  const id = (value: string) => value as Id<"submissions">;
  const full = ["a", "hidden", "b", "c"].map(id);
  const visible = ["a", "b", "c"].map(id);
  expect(beforeIdAfterDrop(full, visible, id("c"), id("a"))).toBe(id("a"));
  expect(beforeIdAfterDrop(full, visible, id("a"), id("c"))).toBeUndefined();
  expect(beforeIdAfterDrop(["a", "hidden", "b", "c", "tail"].map(id), visible, id("a"), id("c"))).toBe(id("tail"));
  expect(beforeIdAfterDrop(["a", "b"].map(id), ["a", "b"].map(id), id("a"), id("b"))).toBeUndefined();
});
