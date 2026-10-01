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
    name: `${name} Luma Guest`,
    displayName: `${name.toLowerCase()}.code`,
  });
}

async function addSubmission(
  ctx: MutationCtx,
  participantId: Id<"participants">,
  n: number,
  status: Status,
  extra: {
    queueOrder?: number;
    printingAt?: number;
    doneAt?: number;
    printRequested?: boolean;
    printer?: string;
    preview?: boolean;
  } = {}
) {
  const storageId = await ctx.storage.store(new Blob(["solid x\nendsolid x\n"]));
  const submissionId = await ctx.db.insert("submissions", {
    participantId,
    storageId,
    originalFileName: `private-file-${n}.stl`,
    kind: "stl",
    sizeBytes: 20,
    title: `Design ${n}`,
    notes: `private note ${n}`,
    colour: "Red",
    printRequested: extra.printRequested ?? true,
    status,
    printCode: `KC-${String(n).padStart(3, "0")}`,
    rejectionReason: status === "rejected" ? "private rejection reason" : undefined,
    reviewedBy: "reviewer@secret.example.com",
    queueOrder: extra.queueOrder,
    queuedAt: status === "submitted" || status === "rejected" ? undefined : 1000 + n,
    printingAt: extra.printingAt,
    printer: extra.printer,
    doneAt: extra.doneAt,
  });
  if (extra.preview) {
    const previewStorageId = await ctx.storage.store(new Blob(["preview"], { type: "image/png" }));
    await ctx.db.patch(submissionId, { previewStorageId });
  }
  return submissionId;
}

function expectNoPrivateFields(board: unknown) {
  const json = JSON.stringify(board);
  for (const secret of ["secret.example.com", "Luma Guest", "private note", "private-file", "private rejection", "user-"]) {
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
    "previewStorageId",
    "clerkUserId",
    "_id",
  ]);
  JSON.parse(json, (key, value) => {
    expect(forbiddenKeys.has(key)).toBe(false);
    return value;
  });
}

async function addSettings(
  ctx: MutationCtx,
  options: {
    showResultsOnTv?: boolean;
    submissionsOpen?: boolean;
    votingOpen?: boolean;
    announcement?: string;
    submissionsDeadline?: number;
  } = {}
) {
  await ctx.db.insert("settings", {
    submissionsOpen: options.submissionsOpen ?? true,
    votingOpen: options.votingOpen ?? false,
    showResultsOnTv: options.showResultsOnTv ?? true,
    maxFileBytes: 1,
    colours: [],
    nextPrintNumber: 10,
    ...(options.announcement === undefined ? {} : { announcement: options.announcement }),
    ...(options.submissionsDeadline === undefined ? {} : { submissionsDeadline: options.submissionsDeadline }),
  });
}

test("queue mode exposes only public-safe fields", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("settings", {
      submissionsOpen: true,
      votingOpen: true,
      showResultsOnTv: false,
      maxFileBytes: 1,
      colours: [],
      nextPrintNumber: 10,
    });
    const ada = await addParticipant(ctx, "Ada");
    await addSubmission(ctx, ada, 1, "printing", {
      queueOrder: 1,
      printingAt: 5000,
      printer: "Ultimaker",
    });
    await addSubmission(ctx, ada, 6, "printing", { queueOrder: 2, printingAt: 6000 });
    await addSubmission(ctx, ada, 2, "queued", { queueOrder: 2 });
    const grace = await addParticipant(ctx, "Grace");
    await addSubmission(ctx, grace, 3, "done", { queueOrder: 0, doneAt: 4000 });
    await addSubmission(ctx, grace, 4, "rejected");
    await addSubmission(ctx, grace, 5, "submitted");
  });
  const board = await t.query(api.tv.board);
  expectNoPrivateFields(board);
  if (board.mode !== "queue") throw new Error("expected queue mode");
  expect(board.notices).toEqual({ announcement: null, submissionsOpen: true, submissionsDeadline: null });
  expect(board.counts).toEqual({ submitted: 5, queued: 1, printing: 2, done: 1 });
  expect(board.printing[0]).toMatchObject({
    printCode: "KC-001",
    title: "Design 1",
    displayName: "ada.code",
    colour: "Red",
    status: "printing",
    printingAt: 5000,
    printer: "Ultimaker",
    file: { kind: "stl" },
  });
  expect(board.printing[1].printer).toBeNull();
  expect(board.printing[0].file?.url).toMatch(/^https?:\/\//);
  expect(JSON.stringify(board)).toContain("ada.code");
  expect(JSON.stringify(board)).not.toContain("Ada Luma Guest");
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

test("results mode ranks eligible entries across statuses and returns a public-safe winner", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await addSettings(ctx, {
      submissionsOpen: false,
      announcement: "Pizza is ready",
      submissionsDeadline: 123_456,
    });
    const voters = await Promise.all(["V1", "V2", "V3", "V4", "V5"].map((n) => addParticipant(ctx, n)));
    const maker = await addParticipant(ctx, "Maker");
    const queuedMaker = await addParticipant(ctx, "QueuedMaker");
    const submittedMaker = await addParticipant(ctx, "SubmittedMaker");
    const rejectedMaker = await addParticipant(ctx, "RejectedMaker");
    const unrequestedMaker = await addParticipant(ctx, "UnrequestedMaker");
    const printing = await addSubmission(ctx, maker, 5, "printing", { printingAt: 5 });
    const queued = await addSubmission(ctx, queuedMaker, 6, "queued", { queueOrder: 1 });
    const submitted = await addSubmission(ctx, submittedMaker, 7, "submitted");
    const rejected = await addSubmission(ctx, rejectedMaker, 8, "rejected");
    const notRequested = await addSubmission(ctx, unrequestedMaker, 9, "done", { doneAt: 9, printRequested: false });
    const vote = (voter: number, submissionId: Id<"submissions">) =>
      ctx.db.insert("votes", { voterId: voters[voter], submissionId });
    await vote(0, printing);
    await vote(1, printing);
    await vote(2, printing);
    await vote(0, queued);
    await vote(1, queued);
    await vote(2, submitted);
    await vote(3, rejected);
    await vote(4, notRequested);
  });
  const board = await t.query(api.tv.board);
  expectNoPrivateFields(board);
  if (board.mode !== "results") throw new Error("expected results mode");
  expect(Object.keys(board).sort()).toEqual(["counts", "mode", "notices", "runnersUp", "totalVotes", "winner"]);
  expect(board.notices).toEqual({
    announcement: "Pizza is ready",
    submissionsOpen: false,
    submissionsDeadline: 123_456,
  });
  expect(board.totalVotes).toBe(6);
  expect(board.winner).toMatchObject({
    rank: 1,
    printCode: "KC-005",
    title: "Design 5",
    displayName: "maker.code",
    status: "printing",
    votes: 3,
    file: { kind: "stl" },
  });
  expect(board.winner?.file?.url).toMatch(/^https?:\/\//);
  expect(board.runnersUp.map((l) => [l.rank, l.printCode, l.votes])).toEqual([
    [2, "KC-006", 2],
    [3, "KC-007", 1],
  ]);
  expect(board.runnersUp.every((l) => !Object.hasOwn(l, "file"))).toBe(true);
  expect(JSON.stringify(board)).toContain("maker.code");
  expect(JSON.stringify(board)).not.toContain("Maker Luma Guest");
});

test("results mode has default notices and no winner without votes", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await addSettings(ctx);
    const maker = await addParticipant(ctx, "Maker");
    await addSubmission(ctx, maker, 1, "done", { doneAt: 1 });
  });
  const board = await t.query(api.tv.board);
  expectNoPrivateFields(board);
  if (board.mode !== "results") throw new Error("expected results mode");
  expect(board.notices).toEqual({ announcement: null, submissionsOpen: true, submissionsDeadline: null });
  expect(board.totalVotes).toBe(0);
  expect(board.winner).toBeNull();
  expect(board.runnersUp).toEqual([]);
});

test("results board does not include the independent designs collage", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await addSettings(ctx, { showResultsOnTv: true });
  });
  const board = await t.query(api.tv.board);
  if (board.mode !== "results") throw new Error("expected results mode");
  expect(Object.hasOwn(board, "collage")).toBe(false);
});

test("designs exposes the live ranking regardless of the TV results setting", async () => {
  for (const showResultsOnTv of [true, false]) {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await addSettings(ctx, { showResultsOnTv });
      const voter = await addParticipant(ctx, "Voter");
      const maker = await addParticipant(ctx, "Maker");
      const submission = await addSubmission(ctx, maker, 1, "done", { doneAt: 1 });
      await ctx.db.insert("votes", { voterId: voter, submissionId: submission });
    });
    const designs = await t.query(api.tv.designs);
    expectNoPrivateFields(designs);
    expect(designs.leaderboard).toMatchObject([
      { rank: 1, printCode: "KC-001", votes: 1, likes: 0 },
    ]);
    expect(designs.totalVotes).toBe(1);
  }
});

test("designs collage includes newest public previews and caps at 60", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await addSettings(ctx);
    const maker = await addParticipant(ctx, "Maker");
    for (let n = 1; n <= 63; n++) {
      await addSubmission(ctx, maker, n, "done", { doneAt: n, preview: true });
    }
    await addSubmission(ctx, maker, 64, "rejected", { preview: true });
    await addSubmission(ctx, maker, 65, "done", { doneAt: 65, printRequested: false, preview: true });
    await addSubmission(ctx, maker, 66, "done", { doneAt: 66 });
  });

  const designs = await t.query(api.tv.designs);
  expectNoPrivateFields(designs);
  expect(designs.collage).toHaveLength(60);
  expect(designs.collage[0].printCode).toBe("KC-063");
  expect(designs.collage.at(-1)?.printCode).toBe("KC-004");
  expect(designs.collage.map((item) => item.printCode)).not.toContain("KC-064");
  expect(designs.collage.map((item) => item.printCode)).not.toContain("KC-065");
  expect(designs.collage.map((item) => item.printCode)).not.toContain("KC-066");
  expect(designs.collage.every((item) => item.previewUrl.startsWith("http"))).toBe(true);
  for (const item of designs.collage) {
    expect(Object.keys(item).sort()).toEqual([
      "colour",
      "displayName",
      "previewUrl",
      "printCode",
      "title",
    ]);
  }
});

test("results mode excludes votes on designs that are no longer entries", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await addSettings(ctx);
    const voter = await addParticipant(ctx, "Voter");
    const maker = await addParticipant(ctx, "Maker");
    const withdrawn = await addSubmission(ctx, maker, 1, "done", { doneAt: 1 });
    await ctx.db.insert("votes", { voterId: voter, submissionId: withdrawn });
    await ctx.db.patch(withdrawn, { printRequested: false });
  });
  const board = await t.query(api.tv.board);
  if (board.mode !== "results") throw new Error("expected results mode");
  expect(board.totalVotes).toBe(0);
  expect(board.winner).toBeNull();
});

test("queue mode ranks liked entries across statuses and excludes rejected designs", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await addSettings(ctx, {
      showResultsOnTv: false,
      submissionsOpen: false,
      announcement: "Printing starts soon",
      submissionsDeadline: 456_789,
    });
    const fans = await Promise.all(["F1", "F2", "F3", "F4", "F5"].map((n) => addParticipant(ctx, n)));
    const maker = await addParticipant(ctx, "Maker");
    const done: Id<"submissions">[] = [];
    for (let n = 1; n <= 7; n++) done.push(await addSubmission(ctx, maker, n, "done", { doneAt: n }));
    const queued = await addSubmission(ctx, maker, 8, "queued", { queueOrder: 1 });
    const printing = await addSubmission(ctx, maker, 9, "printing", { printingAt: 9 });
    const submitted = await addSubmission(ctx, maker, 10, "submitted");
    const rejected = await addSubmission(ctx, maker, 11, "rejected");
    const like = (fan: number, submissionId: Id<"submissions">, reaction: "like" | "skip" = "like") =>
      ctx.db.insert("likes", { participantId: fans[fan], submissionId, reaction, updatedAt: 1 });
    // Ties sort by print code.
    for (const f of [0, 1, 2, 3]) await like(f, done[2]);
    for (const f of [0, 1, 2]) await like(f, done[0]);
    for (const f of [0, 1]) await like(f, done[4]);
    for (const f of [2, 3]) await like(f, done[1]);
    await like(0, done[5]);
    await like(3, done[3]);
    await like(1, done[3], "skip");
    await like(3, done[6], "skip");
    for (const f of [0, 1, 2, 3]) await like(f, queued);
    for (const f of [0, 1, 2]) await like(f, printing);
    for (const f of [0, 1, 2]) await like(f, submitted);
    for (const f of [0, 1, 2, 3, 4]) await like(f, rejected);
  });
  const board = await t.query(api.tv.board);
  expectNoPrivateFields(board);
  if (board.mode !== "queue") throw new Error("expected queue mode");
  expect(board.notices).toEqual({
    announcement: "Printing starts soon",
    submissionsOpen: false,
    submissionsDeadline: 456_789,
  });
  expect(board.leaderboard.map((r) => [r.printCode, r.votes, r.likes, r.rank])).toEqual([
    ["KC-003", 0, 4, 1],
    ["KC-008", 0, 4, 1],
    ["KC-001", 0, 3, 3],
    ["KC-009", 0, 3, 3],
    ["KC-010", 0, 3, 3],
    ["KC-002", 0, 2, 6],
    ["KC-005", 0, 2, 6],
    ["KC-004", 0, 1, 8],
    ["KC-006", 0, 1, 8],
  ]);
  expect(board.leaderboard.some((row) => row.printCode === "KC-007")).toBe(false);
  expect(board.leaderboard.some((row) => row.printCode === "KC-011")).toBe(false);
  expect(board.totalVotes).toBe(0);
  expect(board.totalLikes).toBe(23);
  expect(Object.keys(board.leaderboard[0]).sort()).toEqual([
    "colour",
    "displayName",
    "likes",
    "printCode",
    "rank",
    "title",
    "votes",
  ]);
  expect(board.leaderboard[0].displayName).toBe("maker.code");
});

test("live leaderboard ranks by votes, likes break ties", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await addSettings(ctx, { showResultsOnTv: false, votingOpen: true });
    const makers = await Promise.all(
      ["MakerA", "MakerB", "MakerC", "MakerD", "MakerE"].map((name) => addParticipant(ctx, name))
    );
    const voters = await Promise.all(["V1", "V2", "V3", "V4", "V5"].map((name) => addParticipant(ctx, name)));
    const entries = await Promise.all(
      makers.map((maker, index) => addSubmission(ctx, maker, index + 1, "done", { doneAt: index + 1 }))
    );
    const vote = (voter: number, entry: number) =>
      ctx.db.insert("votes", { voterId: voters[voter], submissionId: entries[entry] });
    const like = (voter: number, entry: number) =>
      ctx.db.insert("likes", {
        participantId: voters[voter],
        submissionId: entries[entry],
        reaction: "like",
        updatedAt: 1,
      });

    await vote(0, 0);
    await vote(1, 0);
    await vote(2, 1);
    await vote(3, 2);
    for (const voter of [0, 1, 2]) await like(voter, 1);
    await like(0, 2);
    for (const voter of [0, 1, 2, 3, 4]) await like(voter, 3);
  });
  const board = await t.query(api.tv.board);
  const live = await t.query(api.tv.leaderboard, {});
  expectNoPrivateFields(board);
  expectNoPrivateFields(live);
  if (board.mode !== "queue") throw new Error("expected queue mode");
  const expected = [
    ["KC-001", 2, 0, 1],
    ["KC-002", 1, 3, 2],
    ["KC-003", 1, 1, 3],
    ["KC-004", 0, 5, 4],
  ];
  expect(board.leaderboard.map((row) => [row.printCode, row.votes, row.likes, row.rank])).toEqual(expected);
  expect(board.totalVotes).toBe(4);
  expect(board.totalLikes).toBe(9);
  expect(live).toEqual({
    leaderboard: board.leaderboard,
    totalVotes: board.totalVotes,
    totalLikes: board.totalLikes,
    votingOpen: true,
    votingNotOpenYet: false,
  });
});

test("live leaderboard distinguishes unopened voting from voting that has closed", async () => {
  const previousOwnerEmail = process.env.OWNER_EMAIL;
  process.env.OWNER_EMAIL = "owner@example.com";
  try {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({
      subject: "owner-user",
      email: "owner@example.com",
      emailVerified: true,
    });
    const initial = await t.query(api.tv.leaderboard, {});
    expect(initial.votingOpen).toBe(false);
    expect(initial.votingNotOpenYet).toBe(true);

    await owner.mutation(api.settings.update, { votingOpen: true });
    await owner.mutation(api.settings.update, { votingOpen: false });
    const closed = await t.query(api.tv.leaderboard, {});
    expect(closed.votingOpen).toBe(false);
    expect(closed.votingNotOpenYet).toBe(false);
  } finally {
    if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = previousOwnerEmail;
  }
});

test("live leaderboard caps at 10 rows", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await addSettings(ctx, { showResultsOnTv: false });
    const maker = await addParticipant(ctx, "Maker");
    const voter = await addParticipant(ctx, "Voter");
    for (let n = 1; n <= 12; n++) {
      const entry = await addSubmission(ctx, maker, n, "done", { doneAt: n });
      await ctx.db.insert("likes", {
        participantId: voter,
        submissionId: entry,
        reaction: "like",
        updatedAt: n,
      });
    }
  });
  const live = await t.query(api.tv.leaderboard, {});
  expectNoPrivateFields(live);
  expect(live.leaderboard).toHaveLength(10);
  expect(live.leaderboard.map((row) => row.printCode)).toEqual(
    Array.from({ length: 10 }, (_, index) => `KC-${String(index + 1).padStart(3, "0")}`)
  );
  expect(live.totalLikes).toBe(12);
});

test("results mode breaks vote ties by likes", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await addSettings(ctx);
    const fans = await Promise.all(["V1", "V2", "V3"].map((n) => addParticipant(ctx, n)));
    const makers = await Promise.all(["MakerA", "MakerB", "MakerC"].map((n) => addParticipant(ctx, n)));
    const a = await addSubmission(ctx, makers[0], 1, "done", { doneAt: 1 });
    const b = await addSubmission(ctx, makers[1], 2, "done", { doneAt: 2 });
    const c = await addSubmission(ctx, makers[2], 3, "done", { doneAt: 3 });
    for (const s of [a, b]) await ctx.db.insert("votes", { voterId: fans[0], submissionId: s });
    await ctx.db.insert("votes", { voterId: fans[1], submissionId: c });
    await ctx.db.insert("likes", { participantId: fans[1], submissionId: c, reaction: "like", updatedAt: 1 });
    await ctx.db.insert("likes", { participantId: fans[2], submissionId: c, reaction: "like", updatedAt: 1 });
    await ctx.db.insert("likes", { participantId: fans[1], submissionId: b, reaction: "like", updatedAt: 1 });
    await ctx.db.insert("likes", { participantId: fans[2], submissionId: a, reaction: "like", updatedAt: 1 });
  });
  const board = await t.query(api.tv.board);
  expectNoPrivateFields(board);
  if (board.mode !== "results") throw new Error("expected results mode");
  expect(board.winner && [board.winner.rank, board.winner.printCode, board.winner.votes, board.winner.likes]).toEqual([
    1, "KC-003", 1, 2,
  ]);
  expect(board.runnersUp.map((l) => [l.rank, l.printCode, l.votes, l.likes])).toEqual([
    [2, "KC-001", 1, 1],
    [3, "KC-002", 1, 1],
  ]);
});
