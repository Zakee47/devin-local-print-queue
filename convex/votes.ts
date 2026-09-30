import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./admins";
import { requireParticipant, viewerParticipant } from "./participants";
import { readSettings } from "./settings";
import { reactionCounts } from "./likes";
import { MAX_VOTES_PER_PARTICIPANT, VOTES_ARE_FINAL } from "../lib/event";
import { rankRows } from "../lib/ranking";

async function doneSubmissions(ctx: QueryCtx | MutationCtx) {
  const rows = await ctx.db
    .query("submissions")
    .withIndex("by_status", (q) => q.eq("status", "done"))
    .collect();
  return rows.sort((a, b) => a.printCode.localeCompare(b.printCode));
}

// Votes that still count: the voter's picks among currently-done submissions.
async function countedVotes(ctx: QueryCtx | MutationCtx, voterId: Id<"participants">) {
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_voter", (q) => q.eq("voterId", voterId))
    .collect();
  const counted: Doc<"votes">[] = [];
  for (const vote of votes) {
    const submission = await ctx.db.get(vote.submissionId);
    if (submission?.status === "done") counted.push(vote);
  }
  return counted;
}

export type GalleryEntry = {
  _id: Id<"submissions">;
  printCode: string;
  title: string;
  colour?: string;
  kind: "stl" | "3mf";
  displayName: string;
  fileUrl: string | null;
};

// Public: every printed entry. Display names only, never emails.
export const gallery = query({
  args: {},
  handler: async (ctx): Promise<GalleryEntry[]> => {
    const entries: GalleryEntry[] = [];
    for (const s of await doneSubmissions(ctx)) {
      const participant = await ctx.db.get(s.participantId);
      entries.push({
        _id: s._id,
        printCode: s.printCode,
        title: s.title,
        colour: s.colour,
        kind: s.kind,
        displayName: participant?.displayName ?? "Anonymous",
        fileUrl: await ctx.storage.getUrl(s.storageId),
      });
    }
    return entries;
  },
});

// The viewer's ballot, or null if they aren't a registered participant.
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const participant = await viewerParticipant(ctx);
    if (!participant) return null;
    const votes = await countedVotes(ctx, participant._id);
    const own = await ctx.db
      .query("submissions")
      .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
      .collect();
    return {
      votedSubmissionIds: votes.map((vote) => vote.submissionId),
      ownSubmissionIds: own.map((s) => s._id),
      votesLeft: Math.max(0, MAX_VOTES_PER_PARTICIPANT - votes.length),
      maxVotes: MAX_VOTES_PER_PARTICIPANT,
      votesAreFinal: VOTES_ARE_FINAL,
    };
  },
});

export const cast = mutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const participant = await requireParticipant(ctx);
    if (!(await readSettings(ctx)).votingOpen) throw new Error("Voting is closed");
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.status !== "done") {
      throw new Error("Only printed entries can be voted for");
    }
    if (submission.participantId === participant._id) {
      throw new Error("You can't vote for your own entry");
    }
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_voter_submission", (q) =>
        q.eq("voterId", participant._id).eq("submissionId", submissionId)
      )
      .unique();
    if (existing) throw new Error("You've already voted for this entry");
    const votes = await countedVotes(ctx, participant._id);
    if (votes.length >= MAX_VOTES_PER_PARTICIPANT) {
      throw new Error(
        VOTES_ARE_FINAL
          ? `You've used all ${MAX_VOTES_PER_PARTICIPANT} votes.`
          : `You've used all ${MAX_VOTES_PER_PARTICIPANT} votes. Remove one to vote again.`
      );
    }
    return await ctx.db.insert("votes", { voterId: participant._id, submissionId });
  },
});

export const retract = mutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const participant = await requireParticipant(ctx);
    if (VOTES_ARE_FINAL) throw new Error("Votes are final once confirmed");
    if (!(await readSettings(ctx)).votingOpen) throw new Error("Voting is closed");
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_voter_submission", (q) =>
        q.eq("voterId", participant._id).eq("submissionId", submissionId)
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export type ResultRow = {
  submissionId: Id<"submissions">;
  printCode: string;
  title: string;
  colour?: string;
  participantName: string;
  participantEmail: string;
  displayName: string;
  votes: number;
  likes: number;
  skips: number;
};

// Admin: done entries ranked by votes then likes (full ties share a rank), plus turnout.
export const results = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const submissions = await doneSubmissions(ctx);
    const rows: ResultRow[] = [];
    const voters = new Set<Id<"participants">>();
    const reactions = await reactionCounts(ctx);
    for (const s of submissions) {
      const participant = await ctx.db.get(s.participantId);
      const votes = await ctx.db
        .query("votes")
        .withIndex("by_submission", (q) => q.eq("submissionId", s._id))
        .collect();
      for (const vote of votes) voters.add(vote.voterId);
      rows.push({
        submissionId: s._id,
        printCode: s.printCode,
        title: s.title,
        colour: s.colour,
        participantName: participant?.name ?? "Unknown",
        participantEmail: participant?.email ?? "",
        displayName: participant?.displayName ?? "Anonymous",
        votes: votes.length,
        likes: reactions.get(s._id)?.likes ?? 0,
        skips: reactions.get(s._id)?.skips ?? 0,
      });
    }
    const ranked = rankRows(rows);
    const participants = (await ctx.db.query("participants").collect()).length;
    return { rows: ranked, voters: voters.size, participants };
  },
});
