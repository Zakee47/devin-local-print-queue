import { internalAction, internalMutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { DEFAULT_SETTINGS, readSettings } from "./settings";
import { reactionCounts, type ReactionCounts } from "./likes";
import { tallyVotes } from "./votes";
import { listEntries } from "./entries";
import { DEFAULT_COLOURS } from "../lib/event";
import { formatPrintCode } from "../lib/files";
import { usernameKey } from "../lib/usernames";
import { compareRanking, rankRows } from "../lib/ranking";

export const UP_NEXT_LIMIT = 8;
export const RECENT_DONE_LIMIT = 3;
export const LEADERBOARD_LIMIT = 10;

// Everything the public TV may show about a submission. Never add emails,
// notes, file names, rejection reasons or reviewer details here.
export type TvItem = {
  printCode: string;
  title: string;
  displayName: string;
  colour: string | null;
  status: Doc<"submissions">["status"];
  submittedAt: number;
  queuedAt: number | null;
  printingAt: number | null;
  doneAt: number | null;
};

export type TvPrintingItem = TvItem & { file: { url: string; kind: "stl" | "3mf" } | null };
export type TvLeader = TvItem & { rank: number; votes: number; likes: number };
export type TvRanked = {
  rank: number;
  printCode: string;
  title: string;
  displayName: string;
  colour: string | null;
  votes: number;
  likes: number;
};
export type TvLive = { leaderboard: TvRanked[]; totalVotes: number; totalLikes: number };

export type TvCounts = { submitted: number; queued: number; printing: number; done: number };
export type TvNotices = { announcement: string | null; submissionsOpen: boolean; submissionsDeadline: number | null };
export type TvWinner = TvLeader & { file: { url: string; kind: "stl" | "3mf" } | null };

export type TvBoard =
  | {
      mode: "queue";
      counts: TvCounts;
      notices: TvNotices;
      printing: TvPrintingItem[];
      upNext: TvItem[];
      moreQueued: number;
      recentDone: TvItem[];
      leaderboard: TvRanked[];
      totalVotes: number;
      totalLikes: number;
    }
  | {
      mode: "results";
      counts: TvCounts;
      notices: TvNotices;
      totalVotes: number;
      winner: TvWinner | null;
      runnersUp: TvLeader[];
    };

async function byStatus(ctx: QueryCtx, status: Doc<"submissions">["status"]) {
  return await ctx.db
    .query("submissions")
    .withIndex("by_status", (q) => q.eq("status", status))
    .collect();
}

function makeNamer(ctx: QueryCtx) {
  const cache = new Map<Id<"participants">, Promise<string>>();
  return (id: Id<"participants">) => {
    let name = cache.get(id);
    if (!name) {
      name = ctx.db.get(id).then((p) => p?.displayName ?? "Anonymous");
      cache.set(id, name);
    }
    return name;
  };
}

async function toItem(
  s: Doc<"submissions">,
  nameOf: (id: Id<"participants">) => Promise<string>
): Promise<TvItem> {
  return {
    printCode: s.printCode,
    title: s.title,
    displayName: await nameOf(s.participantId),
    colour: s.colour ?? null,
    status: s.status,
    submittedAt: s._creationTime,
    queuedAt: s.queuedAt ?? null,
    printingAt: s.printingAt ?? null,
    doneAt: s.doneAt ?? null,
  };
}

async function liveRanking(
  ctx: QueryCtx,
  entries: Doc<"submissions">[],
  reactions: Map<Id<"submissions">, ReactionCounts>,
  nameOf: (id: Id<"participants">) => Promise<string>
): Promise<TvLive> {
  const { tally } = await tallyVotes(ctx);
  const rows = entries.map((s) => ({
    s,
    printCode: s.printCode,
    votes: tally.get(s._id) ?? 0,
    likes: reactions.get(s._id)?.likes ?? 0,
  }));
  const totalVotes = rows.reduce((total, row) => total + row.votes, 0);
  const totalLikes = rows.reduce((total, row) => total + row.likes, 0);
  const leaderboard = await Promise.all(
    rankRows(rows.filter((row) => row.votes > 0 || row.likes > 0))
      .slice(0, LEADERBOARD_LIMIT)
      .map(async (row): Promise<TvRanked> => ({
        rank: row.rank,
        printCode: row.printCode,
        title: row.s.title,
        displayName: await nameOf(row.s.participantId),
        colour: row.s.colour ?? null,
        votes: row.votes,
        likes: row.likes,
      }))
  );
  return { leaderboard, totalVotes, totalLikes };
}

const queueKey = (s: Doc<"submissions">) => s.queueOrder ?? s.queuedAt ?? s._creationTime;

// Public, unauthenticated feed for the venue TV at /tv.
export const board = query({
  args: {},
  handler: async (ctx): Promise<TvBoard> => {
    const settings = await readSettings(ctx);
    const nameOf = makeNamer(ctx);
    const [submitted, queued, printing, done, entries, reactions] = await Promise.all([
      byStatus(ctx, "submitted"),
      byStatus(ctx, "queued"),
      byStatus(ctx, "printing"),
      byStatus(ctx, "done"),
      listEntries(ctx),
      reactionCounts(ctx),
    ]);
    const notices: TvNotices = {
      announcement: settings.announcement ?? null,
      submissionsOpen: settings.submissionsOpen,
      submissionsDeadline: settings.submissionsDeadline ?? null,
    };
    const counts: TvCounts = {
      // Every entry received that hasn't been rejected.
      submitted: submitted.length + queued.length + printing.length + done.length,
      queued: queued.length,
      printing: printing.length,
      done: done.length,
    };

    const likesOf = (s: Doc<"submissions">) => reactions.get(s._id)?.likes ?? 0;

    if (settings.showResultsOnTv) {
      const { tally } = await tallyVotes(ctx);
      const totalVotes = [...tally.values()].reduce((total, votes) => total + votes, 0);
      const ranked = entries
        .map((s) => ({ s, printCode: s.printCode, votes: tally.get(s._id) ?? 0, likes: likesOf(s) }))
        .filter((r) => r.votes > 0)
        .sort(compareRanking)
        .slice(0, LEADERBOARD_LIMIT);
      const [first, ...rest] = ranked;
      const winner: TvWinner | null = first
        ? {
            ...(await toItem(first.s, nameOf)),
            rank: 1,
            votes: first.votes,
            likes: first.likes,
            file: await ctx.storage.getUrl(first.s.storageId).then((url) =>
              url ? { url, kind: first.s.kind } : null
            ),
          }
        : null;
      const runnersUp: TvLeader[] = await Promise.all(
        rest.map(async (r, i) => ({
          ...(await toItem(r.s, nameOf)),
          rank: i + 2,
          votes: r.votes,
          likes: r.likes,
        }))
      );
      return { mode: "results", counts, notices, totalVotes, winner, runnersUp };
    }

    const sortedQueue = [...queued].sort((a, b) => queueKey(a) - queueKey(b));
    const upNext = await Promise.all(sortedQueue.slice(0, UP_NEXT_LIMIT).map((s) => toItem(s, nameOf)));
    const printingItems = await Promise.all(
      [...printing]
        .sort((a, b) => (a.printingAt ?? a._creationTime) - (b.printingAt ?? b._creationTime))
        .map(async (s): Promise<TvPrintingItem> => {
          const url = await ctx.storage.getUrl(s.storageId);
          return { ...(await toItem(s, nameOf)), file: url ? { url, kind: s.kind } : null };
        })
    );
    const recentDone = await Promise.all(
      [...done]
        .sort((a, b) => (b.doneAt ?? b._creationTime) - (a.doneAt ?? a._creationTime))
        .slice(0, RECENT_DONE_LIMIT)
        .map((s) => toItem(s, nameOf))
    );
    const live = await liveRanking(ctx, entries, reactions, nameOf);
    return {
      mode: "queue",
      counts,
      notices,
      printing: printingItems,
      upNext,
      moreQueued: Math.max(0, sortedQueue.length - UP_NEXT_LIMIT),
      recentDone,
      ...live,
    };
  },
});

export const leaderboard = query({
  args: {},
  handler: async (ctx): Promise<TvLive & { votingOpen: boolean }> => {
    const [settings, entries, reactions] = await Promise.all([
      readSettings(ctx),
      listEntries(ctx),
      reactionCounts(ctx),
    ]);
    return {
      ...(await liveRanking(ctx, entries, reactions, makeNamer(ctx))),
      votingOpen: settings.votingOpen,
    };
  },
});

// ---------------------------------------------------------------------------
// Local-dev demo data for rehearsing the TV:
//   npx convex run tv:seedDemo
// Generates simple extruded keychain STLs and fills every queue state.

function extrudedStl(outline: [number, number][], depth: number) {
  const tris: number[][] = [];
  const [cx, cy] = outline.reduce(([x, y], [px, py]) => [x + px / outline.length, y + py / outline.length], [0, 0]);
  for (let i = 0; i < outline.length; i++) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[(i + 1) % outline.length];
    tris.push([cx, cy, depth, ax, ay, depth, bx, by, depth]);
    tris.push([cx, cy, 0, bx, by, 0, ax, ay, 0]);
    tris.push([ax, ay, 0, bx, by, 0, bx, by, depth]);
    tris.push([ax, ay, 0, bx, by, depth, ax, ay, depth]);
  }
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  view.setUint32(80, tris.length, true);
  tris.forEach((t, i) => t.forEach((n, j) => view.setFloat32(84 + i * 50 + 12 + j * 4, n, true)));
  return new Blob([buf], { type: "model/stl" });
}

const shape = (points: number, radius: (i: number) => number): [number, number][] =>
  Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    return [Math.cos(a) * radius(i), Math.sin(a) * radius(i)];
  });

const DEMO_SHAPES = [
  shape(10, (i) => (i % 2 ? 9 : 20)),
  shape(48, (i) => 16 + 3 * Math.sin((i / 48) * Math.PI * 12)),
  shape(6, () => 18),
  shape(16, (i) => (i % 2 ? 12 : 20)),
];

const DEMO_ENTRIES: {
  name: string;
  username: string;
  title: string;
  colour: (typeof DEFAULT_COLOURS)[number];
  dimensionsMm: { x: number; y: number; z: number };
  status: Doc<"submissions">["status"];
}[] = [
  { name: "Ada Lovelace", username: "ada.codes", title: "Analytical Engine", colour: "Gold", dimensionsMm: { x: 27, y: 51, z: 40 }, status: "printing" },
  { name: "Grace Hopper", username: "gracebug", title: "First Bug", colour: "Silver", dimensionsMm: { x: 38.5, y: 50, z: 4.5 }, status: "printing" },
  { name: "Alan Turing", username: "turing_t", title: "Enigma Rotor", colour: "Sea Green", dimensionsMm: { x: 40, y: 40, z: 4 }, status: "queued" },
  { name: "Katherine Johnson", username: "katherinej", title: "Orbit Ring", colour: "Sky Blue", dimensionsMm: { x: 34, y: 48, z: 6 }, status: "queued" },
  { name: "Linus Torvalds", username: "linus.dev", title: "Tux Tag", colour: "Black", dimensionsMm: { x: 42, y: 39, z: 5 }, status: "queued" },
  { name: "Margaret Hamilton", username: "margaret.h", title: "Apollo Star", colour: "White", dimensionsMm: { x: 31, y: 52, z: 7 }, status: "queued" },
  { name: "Tim Berners-Lee", username: "tim.berners", title: "WWW Hex", colour: "Silver", dimensionsMm: { x: 45, y: 36, z: 4 }, status: "queued" },
  { name: "Hedy Lamarr", username: "hedywaves", title: "Frequency Hop", colour: "Gold", dimensionsMm: { x: 36, y: 49, z: 8 }, status: "queued" },
  { name: "Dennis Ritchie", username: "dennis_r", title: "Curly Brace", colour: "Sea Green", dimensionsMm: { x: 39, y: 42, z: 5.5 }, status: "queued" },
  { name: "Barbara Liskov", username: "barbara.l", title: "Substitution", colour: "Sky Blue", dimensionsMm: { x: 33, y: 46, z: 9 }, status: "queued" },
  { name: "Ken Thompson", username: "ken.thompson", title: "Unix Tag", colour: "Black", dimensionsMm: { x: 41, y: 37, z: 4.5 }, status: "queued" },
  { name: "Frances Allen", username: "frances.a", title: "Optimiser", colour: "White", dimensionsMm: { x: 30, y: 54, z: 6 }, status: "queued" },
  { name: "John McCarthy", username: "johnlambda", title: "Lambda", colour: "Silver", dimensionsMm: { x: 37, y: 43, z: 5 }, status: "done" },
  { name: "Radia Perlman", username: "radia.p", title: "Spanning Tree", colour: "Gold", dimensionsMm: { x: 35, y: 47, z: 7 }, status: "done" },
  { name: "Donald Knuth", username: "donaldk", title: "TeX Drop", colour: "Sea Green", dimensionsMm: { x: 44, y: 34, z: 4 }, status: "done" },
  { name: "Shafi Goldwasser", username: "shafi.gold", title: "Zero Knowledge", colour: "Sky Blue", dimensionsMm: { x: 32, y: 50, z: 8 }, status: "done" },
  { name: "Vint Cerf", username: "vintc", title: "Packet", colour: "Black", dimensionsMm: { x: 40, y: 40, z: 4 }, status: "submitted" },
];

export const seedDemo = internalAction({
  args: {},
  handler: async (ctx) => {
    const storageIds: Id<"_storage">[] = [];
    for (const outline of DEMO_SHAPES) storageIds.push(await ctx.storage.store(extrudedStl(outline, 4)));
    await ctx.runMutation(internal.tv.insertDemo, { storageIds });
  },
});

export const insertDemo = internalMutation({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, { storageIds }) => {
    const now = Date.now();
    const row = await ctx.db.query("settings").first();
    let next = row?.nextPrintNumber ?? 1;
    const participantIds: Id<"participants">[] = [];
    const submissionIds: Id<"submissions">[] = [];
    for (const [i, e] of DEMO_ENTRIES.entries()) {
      const participantId = await ctx.db.insert("participants", {
        clerkUserId: `demo-${i}-${now}`,
        email: `demo${i}@example.com`,
        name: e.name,
        displayName: e.username,
        usernameKey: usernameKey(e.username),
      });
      participantIds.push(participantId);
      const minutes = (DEMO_ENTRIES.length - i) * 60_000;
      const submissionId = await ctx.db.insert("submissions", {
        participantId,
        storageId: storageIds[i % storageIds.length],
        originalFileName: `${e.title}.stl`,
        kind: "stl",
        sizeBytes: 1024,
        title: e.title,
        notes: "demo notes, never shown on the TV",
        colour: e.colour,
        dimensionsMm: e.dimensionsMm,
        printRequested: true,
        status: e.status,
        printCode: formatPrintCode(next++),
        queueOrder: e.status === "submitted" ? undefined : i,
        queuedAt: e.status === "submitted" ? undefined : now - minutes,
        printingAt: e.status === "printing" ? now - minutes / 3 : undefined,
        doneAt: e.status === "done" ? now - minutes / 4 : undefined,
      });
      submissionIds.push(submissionId);
    }
    const settingsPatch = {
      nextPrintNumber: next,
      submissionsDeadline: row?.submissionsDeadline ?? now + 45 * 60_000,
      announcement: row?.announcement ?? "Pizza's at the bar. Printing runs until 21:00.",
    };
    if (row) await ctx.db.patch(row._id, settingsPatch);
    else await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, ...settingsPatch });
    const demoVotes = [
      [0, [3]],
      [1, [3, 16]],
      [2, [3]],
      [3, [2, 4]],
      [4, [2, 3]],
      [5, [2, 4]],
      [6, [3, 4]],
      [7, [5, 6]],
      [8, [5, 6]],
      [9, [5, 7]],
      [10, [6, 7]],
      [11, [8, 9]],
      [12, [8, 9]],
      [13, [8, 9]],
      [14, [0, 1]],
      [15, [0, 1]],
    ] as const;
    for (const [voter, picks] of demoVotes) {
      for (const pick of picks) {
        await ctx.db.insert("votes", { voterId: participantIds[voter], submissionId: submissionIds[pick] });
      }
    }
    const demoLikes = [
      [0, [4, 16]],
      [1, [4, 16]],
      [2, [4, 16, 0]],
      [3, [4, 16, 1]],
      [4, [3, 5, 0]],
      [5, [4, 6, 0]],
      [6, [4, 7, 0]],
      [7, [4, 8, 0]],
      [8, [2, 6, 0]],
      [9, [2, 8]],
      [10, [2, 9]],
      [11, [2, 10]],
      [12, [5, 6]],
      [13, [5, 7]],
    ] as const;
    for (const [voter, picks] of demoLikes) {
      for (const pick of picks) {
        await ctx.db.insert("likes", {
          participantId: participantIds[voter],
          submissionId: submissionIds[pick],
          reaction: "like",
          updatedAt: now,
        });
      }
    }
  },
});
