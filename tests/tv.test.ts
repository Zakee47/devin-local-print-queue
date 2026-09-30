import { convexTest, type TestConvex } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
type MutationCtx = Parameters<Parameters<TestConvex<typeof schema>["run"]>[0]>[0];

type Status = "submitted" | "rejected" | "queued" | "printing" | "done";

async function addParticipant(ctx: MutationCtx, name: string) {
  return await ctx.db.insert("participants", {
    clerkUserId: `user-${name}`,
    email: `${name.toLowerCase()}@secret.example.com`,
    name: `${name} Secretsurname`,
    displayName: `${name} S.`,
  });
}

async function addSubmission(
  ctx: MutationCtx,
  participantId: Id<"participants">,
  n: number,
  status: Status,
  extra: { queueOrder?: number; printingAt?: number; doneAt?: number } = {}
) {
  const storageId = await ctx.storage.store(new Blob(["solid x\nendsolid x\n"]));
  return await ctx.db.insert("submissions", {
    participantId,
    storageId,
    originalFileName: `private-file-${n}.stl`,
    kind: "stl",
    sizeBytes: 20,
    title: `Design ${n}`,
    notes: `private note ${n}`,
    colour: "Red",
    printRequested: true,
    status,
    printCode: `KC-${String(n).padStart(3, "0")}`,
    rejectionReason: status === "rejected" ? "private rejection reason" : undefined,
    reviewedBy: "reviewer@secret.example.com",
    queueOrder: extra.queueOrder,
    queuedAt: status === "submitted" || status === "rejected" ? undefined : 1000 + n,
    printingAt: extra.printingAt,
    doneAt: extra.doneAt,
  });
}

function expectNoPrivateFields(board: unknown) {
  const json = JSON.stringify(board);
  for (const secret of ["secret.example.com", "Secretsurname", "private note", "private-file", "private rejection", "user-"]) {
    expect(json).not.toContain(secret);
  }
  const forbiddenKeys = new Set([
    "email",
    "notes",
    "originalFileName",
    "rejectionReason",
    "reviewedBy",
    "participantId",
    "storageId",
    "clerkUserId",
    "_id",
  ]);
  JSON.parse(json, (key, value) => {
    expect(forbiddenKeys.has(key)).toBe(false);
    return value;
  });
}

test("queue mode exposes only public-safe fields", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const ada = await addParticipant(ctx, "Ada");
    await addSubmission(ctx, ada, 1, "printing", { queueOrder: 1, printingAt: 5000 });
    await addSubmission(ctx, ada, 2, "queued", { queueOrder: 2 });
    const grace = await addParticipant(ctx, "Grace");
    await addSubmission(ctx, grace, 3, "done", { queueOrder: 0, doneAt: 4000 });
    await addSubmission(ctx, grace, 4, "rejected");
    await addSubmission(ctx, grace, 5, "submitted");
  });
  const board = await t.query(api.tv.board);
  expectNoPrivateFields(board);
  if (board.mode !== "queue") throw new Error("expected queue mode");
  expect(board.counts).toEqual({ submitted: 4, queued: 1, printing: 1, done: 1 });
  expect(board.printing[0]).toMatchObject({
    printCode: "KC-001",
    title: "Design 1",
    displayName: "Ada S.",
    colour: "Red",
    status: "printing",
    printingAt: 5000,
    file: { kind: "stl" },
  });
  expect(board.printing[0].file?.url).toMatch(/^https?:\/\//);
  // Only the printing item carries a file URL.
  expect(Object.keys(board.upNext[0])).not.toContain("file");
  expect(Object.keys(board.recentDone[0])).not.toContain("file");
  // Rejected and unreviewed entries never reach the TV lists.
  const shown = [...board.printing, ...board.upNext, ...board.recentDone].map((i) => i.printCode);
  expect(shown).not.toContain("KC-004");
  expect(shown).not.toContain("KC-005");
});

test("orders the queue, printers and finished prints", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const p = await addParticipant(ctx, "Ada");
    // Inserted out of order on purpose.
    const orders = [5, 3, 9, 1, 7, 2, 8, 4, 6, 10];
    for (const [i, queueOrder] of orders.entries()) await addSubmission(ctx, p, 10 + i, "queued", { queueOrder });
    await addSubmission(ctx, p, 30, "printing", { printingAt: 300 });
    await addSubmission(ctx, p, 31, "printing", { printingAt: 100 });
    await addSubmission(ctx, p, 32, "printing", { printingAt: 200 });
    for (const [i, doneAt] of [10, 50, 30, 40, 20].entries()) await addSubmission(ctx, p, 40 + i, "done", { doneAt });
  });
  const board = await t.query(api.tv.board);
  if (board.mode !== "queue") throw new Error("expected queue mode");
  // First 8 by queueOrder; the remaining 2 are summarised.
  expect(board.upNext.map((i) => i.printCode)).toEqual([
    "KC-013", "KC-015", "KC-011", "KC-017", "KC-010", "KC-018", "KC-014", "KC-016",
  ]);
  expect(board.moreQueued).toBe(2);
  // Several printers at once, longest-running first.
  expect(board.printing.map((i) => i.printCode)).toEqual(["KC-031", "KC-032", "KC-030"]);
  // Latest finished first.
  expect(board.recentDone.map((i) => i.printCode)).toEqual(["KC-041", "KC-043", "KC-042"]);
});

test("results mode returns a public-safe leaderboard of done designs", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("settings", {
      submissionsOpen: false,
      votingOpen: false,
      showResultsOnTv: true,
      maxFileBytes: 1,
      colours: [],
      nextPrintNumber: 10,
    });
    const voters = await Promise.all(["V1", "V2", "V3", "V4"].map((n) => addParticipant(ctx, n)));
    const maker = await addParticipant(ctx, "Maker");
    const a = await addSubmission(ctx, maker, 1, "done", { doneAt: 1 });
    const b = await addSubmission(ctx, maker, 2, "done", { doneAt: 2 });
    const c = await addSubmission(ctx, maker, 3, "done", { doneAt: 3 });
    await addSubmission(ctx, maker, 4, "done", { doneAt: 4 }); // no votes
    const printing = await addSubmission(ctx, maker, 5, "printing", { printingAt: 5 });
    const vote = (voter: number, submissionId: Id<"submissions">) =>
      ctx.db.insert("votes", { voterId: voters[voter], submissionId });
    await vote(0, b);
    await vote(1, b);
    await vote(2, b);
    await vote(0, a);
    await vote(1, a);
    await vote(2, c);
    await vote(3, c);
    await vote(3, printing); // not done: ignored
  });
  const board = await t.query(api.tv.board);
  expectNoPrivateFields(board);
  if (board.mode !== "results") throw new Error("expected results mode");
  expect(Object.keys(board).sort()).toEqual(["counts", "leaderboard", "mode", "totalVotes"]);
  expect(board.totalVotes).toBe(7);
  expect(board.leaderboard.map((l) => [l.rank, l.printCode, l.votes])).toEqual([
    [1, "KC-002", 3],
    [2, "KC-001", 2],
    [2, "KC-003", 2],
  ]);
  expect(board.leaderboard[0]).toMatchObject({ title: "Design 2", displayName: "Maker S.", colour: "Red" });
  for (const l of board.leaderboard) expect(Object.keys(l)).not.toContain("file");
});
