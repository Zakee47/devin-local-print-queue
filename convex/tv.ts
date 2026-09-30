import { internalAction, internalMutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { DEFAULT_SETTINGS, readSettings } from "./settings";
import { reactionCounts } from "./likes";
import { displayNameFrom, formatPrintCode } from "../lib/files";
import { usernameKey } from "../lib/usernames";
import { rankRows } from "../lib/ranking";

export const UP_NEXT_LIMIT = 8;
export const RECENT_DONE_LIMIT = 3;
export const LEADERBOARD_LIMIT = 10;
export const MOST_LIKED_LIMIT = 5;

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
export type TvLiked = { printCode: string; title: string; displayName: string; colour: string | null; likes: number };

export type TvCounts = { submitted: number; queued: number; printing: number; done: number };

export type TvBoard =
  | {
      mode: "queue";
      counts: TvCounts;
      printing: TvPrintingItem[];
      upNext: TvItem[];
      moreQueued: number;
      recentDone: TvItem[];
      mostLiked: TvLiked[];
    }
  | { mode: "results"; counts: TvCounts; totalVotes: number; leaderboard: TvLeader[] };

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

const queueKey = (s: Doc<"submissions">) => s.queueOrder ?? s.queuedAt ?? s._creationTime;

// Public, unauthenticated feed for the venue TV at /tv.
export const board = query({
  args: {},
  handler: async (ctx): Promise<TvBoard> => {
    const settings = await readSettings(ctx);
    const nameOf = makeNamer(ctx);
    const [submitted, queued, printing, done] = await Promise.all([
      byStatus(ctx, "submitted"),
      byStatus(ctx, "queued"),
      byStatus(ctx, "printing"),
      byStatus(ctx, "done"),
    ]);
    const counts: TvCounts = {
      // Every entry received that hasn't been rejected.
      submitted: submitted.length + queued.length + printing.length + done.length,
      queued: queued.length,
      printing: printing.length,
      done: done.length,
    };

    const reactions = await reactionCounts(ctx);
    const likesOf = (s: Doc<"submissions">) => reactions.get(s._id)?.likes ?? 0;

    if (settings.showResultsOnTv) {
      const votes = await ctx.db.query("votes").collect();
      const tally = new Map<Id<"submissions">, number>();
      for (const vote of votes) tally.set(vote.submissionId, (tally.get(vote.submissionId) ?? 0) + 1);
      const ranked = rankRows(
        done
          .map((s) => ({ s, printCode: s.printCode, votes: tally.get(s._id) ?? 0, likes: likesOf(s) }))
          .filter((r) => r.votes > 0)
      ).slice(0, LEADERBOARD_LIMIT);
      const leaderboard: TvLeader[] = await Promise.all(
        ranked.map(async (r) => ({ ...(await toItem(r.s, nameOf)), rank: r.rank, votes: r.votes, likes: r.likes }))
      );
      const totalVotes = votes.filter((vote) => done.some((s) => s._id === vote.submissionId)).length;
      return { mode: "results", counts, totalVotes, leaderboard };
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
    const mostLiked = await Promise.all(
      done
        .map((s) => ({ s, likes: likesOf(s) }))
        .filter((r) => r.likes > 0)
        .sort((a, b) => b.likes - a.likes || a.s.printCode.localeCompare(b.s.printCode))
        .slice(0, MOST_LIKED_LIMIT)
        .map(
          async ({ s, likes }): Promise<TvLiked> => ({
            printCode: s.printCode,
            title: s.title,
            displayName: await nameOf(s.participantId),
            colour: s.colour ?? null,
            likes,
          })
        )
    );
    return {
      mode: "queue",
      counts,
      printing: printingItems,
      upNext,
      moreQueued: Math.max(0, sortedQueue.length - UP_NEXT_LIMIT),
      recentDone,
      mostLiked,
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

const DEMO_ENTRIES: { name: string; title: string; colour: string; status: Doc<"submissions">["status"] }[] = [
  { name: "Ada Lovelace", title: "Analytical Engine", colour: "Blue", status: "printing" },
  { name: "Grace Hopper", title: "First Bug", colour: "Orange", status: "printing" },
  { name: "Alan Turing", title: "Enigma Rotor", colour: "Green", status: "queued" },
  { name: "Katherine Johnson", title: "Orbit Ring", colour: "Purple", status: "queued" },
  { name: "Linus Torvalds", title: "Tux Tag", colour: "Yellow", status: "queued" },
  { name: "Margaret Hamilton", title: "Apollo Star", colour: "White", status: "queued" },
  { name: "Tim Berners-Lee", title: "WWW Hex", colour: "Red", status: "queued" },
  { name: "Hedy Lamarr", title: "Frequency Hop", colour: "Pink", status: "queued" },
  { name: "Dennis Ritchie", title: "Curly Brace", colour: "Black", status: "queued" },
  { name: "Barbara Liskov", title: "Substitution", colour: "Grey", status: "queued" },
  { name: "Ken Thompson", title: "Unix Tag", colour: "Blue", status: "queued" },
  { name: "Frances Allen", title: "Optimiser", colour: "Green", status: "queued" },
  { name: "John McCarthy", title: "Lambda", colour: "Red", status: "done" },
  { name: "Radia Perlman", title: "Spanning Tree", colour: "Yellow", status: "done" },
  { name: "Donald Knuth", title: "TeX Drop", colour: "Orange", status: "done" },
  { name: "Shafi Goldwasser", title: "Zero Knowledge", colour: "Purple", status: "done" },
  { name: "Vint Cerf", title: "Packet", colour: "White", status: "submitted" },
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
      const displayName = displayNameFrom(e.name);
      const participantId = await ctx.db.insert("participants", {
        clerkUserId: `demo-${i}-${now}`,
        email: `demo${i}@example.com`,
        name: e.name,
        displayName,
        usernameKey: usernameKey(displayName),
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
    if (row) await ctx.db.patch(row._id, { nextPrintNumber: next });
    else await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, nextPrintNumber: next });
    // A few votes so results mode has something to rank.
    const doneIds = submissionIds.filter((_, i) => DEMO_ENTRIES[i].status === "done");
    for (const [voter, picks] of [[0, [0, 1]], [1, [0, 2]], [2, [0, 1]], [3, [1, 3]], [4, [2]]] as const) {
      for (const pick of picks) {
        await ctx.db.insert("votes", { voterId: participantIds[voter], submissionId: doneIds[pick] });
      }
    }
    // Likes and skips for the "Most liked" strip and the tie-breaker.
    for (const [voter, likes, skips] of [
      [5, [0, 1, 2], [3]],
      [6, [1, 3], [0]],
      [7, [1, 2], []],
      [8, [0, 1], [2]],
      [9, [3], [1]],
    ] as const) {
      for (const [picks, reaction] of [[likes, "like"], [skips, "skip"]] as const) {
        for (const pick of picks) {
          await ctx.db.insert("likes", {
            participantId: participantIds[voter],
            submissionId: doneIds[pick],
            reaction,
            updatedAt: now,
          });
        }
      }
    }
  },
});
