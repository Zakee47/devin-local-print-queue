import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { requireOwner } from "./admins";
import { requireParticipant, viewerParticipant } from "./participants";
import { readSettings } from "./settings";
import { countsFor, currentVersion, entryFor, listEntries } from "./entries";
import { reactionCounts } from "./likes";
import { MAX_VOTES_PER_PARTICIPANT, votingNotOpenYet, type SubmissionStatus } from "../lib/event";
import { compareRanking, rankRows } from "../lib/ranking";
import { previewUrlOf } from "./submissions";

export const VOTING_CLOSED_MESSAGE = "Voting has closed — your votes are locked in";

export type EntryStage = "design" | "printing" | "printed";

export function entryStage(status: SubmissionStatus): EntryStage {
  if (status === "done") return "printed";
  if (status === "printing") return "printing";
  return "design";
}

// True while the submission is its owner's current entry.
export async function isEntry(ctx: QueryCtx | MutationCtx, submission: Doc<"submissions"> | null) {
  if (!submission) return false;
  return (await entryFor(ctx, submission.participantId))?._id === submission._id;
}

export async function requireVotingOpen(ctx: QueryCtx | MutationCtx) {
  if (!(await readSettings(ctx)).votingOpen) throw new ConvexError(VOTING_CLOSED_MESSAGE);
}

// Splits a voter's rows into the votes that count (oldest first, capped at the
// allowance), the ones dropped because their submission is no longer an entry,
// and any excess beyond the allowance (an entry that came back after a re-vote).
async function voterBallot(ctx: QueryCtx | MutationCtx, voterId: Id<"participants">) {
  const rows = await ctx.db
    .query("votes")
    .withIndex("by_voter", (q) => q.eq("voterId", voterId))
    .collect();
  rows.sort((a, b) => a._creationTime - b._creationTime);
  const counted: Doc<"votes">[] = [];
  const dropped: {
    vote: Doc<"votes">;
    submission: Doc<"submissions"> | null;
    replaced: boolean;
  }[] = [];
  const excess: Doc<"votes">[] = [];
  for (const vote of rows) {
    const submission = await ctx.db.get(vote.submissionId);
    const entry = await isEntry(ctx, submission);
    if (!entry) {
      dropped.push({ vote, submission, replaced: false });
    } else if (!submission || !countsFor(vote, submission)) {
      dropped.push({ vote, submission, replaced: true });
    } else if (counted.length < MAX_VOTES_PER_PARTICIPANT) {
      counted.push(vote);
    } else {
      excess.push(vote);
    }
  }
  return { counted, dropped, excess };
}

async function deleteUncounted(ctx: MutationCtx, ballot: Awaited<ReturnType<typeof voterBallot>>) {
  for (const { vote } of ballot.dropped) await ctx.db.delete(vote._id);
  for (const vote of ballot.excess) await ctx.db.delete(vote._id);
}

// Counted votes per current entry, ignoring voters whose account was deleted.
export async function tallyVotes(ctx: QueryCtx | MutationCtx) {
  const voterIds = new Set((await ctx.db.query("votes").collect()).map((vote) => vote.voterId));
  const tally = new Map<Id<"submissions">, number>();
  const voters = new Set<Id<"participants">>();
  for (const voterId of voterIds) {
    if (!(await ctx.db.get(voterId))) continue;
    const { counted } = await voterBallot(ctx, voterId);
    if (counted.length > 0) voters.add(voterId);
    for (const vote of counted) tally.set(vote.submissionId, (tally.get(vote.submissionId) ?? 0) + 1);
  }
  return { tally, voters };
}

async function findVote(ctx: MutationCtx, voterId: Id<"participants">, submissionId: Id<"submissions">) {
  return await ctx.db
    .query("votes")
    .withIndex("by_voter_submission", (q) => q.eq("voterId", voterId).eq("submissionId", submissionId))
    .unique();
}

async function requireVotableEntry(
  ctx: MutationCtx,
  participant: Doc<"participants">,
  submissionId: Id<"submissions">
) {
  const submission = await ctx.db.get(submissionId);
  if (!submission || !(await isEntry(ctx, submission))) {
    throw new ConvexError("That design isn't in the running any more");
  }
  if (submission.participantId === participant._id) {
    throw new ConvexError("You can't vote for your own entry");
  }
  return submission;
}

export type GalleryEntry = {
  _id: Id<"submissions">;
  printCode: string;
  title: string;
  colour?: string;
  kind: "stl" | "3mf";
  stage: EntryStage;
  displayName: string;
  fileUrl: string | null;
  previewUrl: string | null;
};

export type MyStanding = {
  votingOpen: boolean;
  votingNotOpenYet: boolean;
  totalEntries: number;
  entries: {
    submissionId: Id<"submissions">;
    printCode: string;
    title: string;
    previewUrl: string | null;
    rank: number;
    votes: number;
    likes: number;
  }[];
} | null;

// Public: every current entry, whatever its print status. Usernames only.
export const gallery = query({
  args: {},
  handler: async (ctx): Promise<GalleryEntry[]> => {
    const entries: GalleryEntry[] = [];
    for (const s of await listEntries(ctx)) {
      const participant = await ctx.db.get(s.participantId);
      if (!participant) continue;
      entries.push({
        _id: s._id,
        printCode: s.printCode,
        title: s.title,
        colour: s.colour,
        kind: s.kind,
        stage: entryStage(s.status),
        displayName: participant.displayName,
        fileUrl: await ctx.storage.getUrl(s.storageId),
        previewUrl: await previewUrlOf(ctx, s),
      });
    }
    return entries;
  },
});

export const myStanding = query({
  args: {},
  handler: async (ctx): Promise<MyStanding> => {
    const participant = await viewerParticipant(ctx);
    if (!participant) return null;

    const entries = await listEntries(ctx);
    const [settings, { tally }, reactions] = await Promise.all([
      readSettings(ctx),
      tallyVotes(ctx),
      reactionCounts(ctx),
    ]);
    const ranked = rankRows(
      entries.map((submission) => ({
        submission,
        printCode: submission.printCode,
        votes: tally.get(submission._id) ?? 0,
        likes: reactions.get(submission._id)?.likes ?? 0,
      }))
    );

    return {
      votingOpen: settings.votingOpen,
      votingNotOpenYet: votingNotOpenYet(settings),
      totalEntries: entries.length,
      entries: await Promise.all(
        ranked
          .filter(({ submission }) => submission.participantId === participant._id)
          .map(async ({ submission, rank, votes, likes }) => ({
            submissionId: submission._id,
            printCode: submission.printCode,
            title: submission.title,
            previewUrl: await previewUrlOf(ctx, submission),
            rank,
            votes,
            likes,
          }))
      ),
    };
  },
});

export type DroppedVote = {
  voteId: Id<"votes">;
  title: string | null;
  printCode: string | null;
  replaced: boolean;
};

// The viewer's ballot, or null if they aren't a registered participant.
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const participant = await viewerParticipant(ctx);
    if (!participant) return null;
    const { counted, dropped } = await voterBallot(ctx, participant._id);
    const own = await ctx.db
      .query("submissions")
      .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
      .collect();
    return {
      votedSubmissionIds: counted.map((vote) => vote.submissionId),
      ownSubmissionIds: own.map((s) => s._id),
      votesLeft: Math.max(0, MAX_VOTES_PER_PARTICIPANT - counted.length),
      maxVotes: MAX_VOTES_PER_PARTICIPANT,
      droppedVotes: dropped.map(
        ({ vote, submission, replaced }): DroppedVote => ({
          voteId: vote._id,
          title: submission?.title ?? null,
          printCode: submission?.printCode ?? null,
          replaced,
        })
      ),
    };
  },
});

export const cast = mutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const participant = await requireParticipant(ctx);
    await requireVotingOpen(ctx);
    const submission = await requireVotableEntry(ctx, participant, submissionId);
    const ballot = await voterBallot(ctx, participant._id);
    if (ballot.counted.some((vote) => vote.submissionId === submissionId)) {
      throw new ConvexError("You've already voted for this design");
    }
    if (ballot.counted.length >= MAX_VOTES_PER_PARTICIPANT) {
      throw new ConvexError(`You've used all ${MAX_VOTES_PER_PARTICIPANT} votes. Remove or swap one to vote again.`);
    }
    await deleteUncounted(ctx, ballot);
    return await ctx.db.insert("votes", {
      voterId: participant._id,
      submissionId,
      version: currentVersion(submission),
    });
  },
});

export const retract = mutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const participant = await requireParticipant(ctx);
    await requireVotingOpen(ctx);
    const existing = await findVote(ctx, participant._id, submissionId);
    if (existing) await ctx.db.delete(existing._id);
  },
});

// Atomically moves one of the viewer's votes to another design.
export const swap = mutation({
  args: { from: v.id("submissions"), to: v.id("submissions") },
  handler: async (ctx, { from, to }) => {
    const participant = await requireParticipant(ctx);
    await requireVotingOpen(ctx);
    const submission = await requireVotableEntry(ctx, participant, to);
    const ballot = await voterBallot(ctx, participant._id);
    const existing = ballot.counted.find((vote) => vote.submissionId === from);
    if (!existing) throw new ConvexError("You haven't voted for that design");
    if (ballot.counted.some((vote) => vote.submissionId === to)) {
      throw new ConvexError("You've already voted for this design");
    }
    await deleteUncounted(ctx, ballot);
    await ctx.db.delete(existing._id);
    return await ctx.db.insert("votes", {
      voterId: participant._id,
      submissionId: to,
      version: currentVersion(submission),
    });
  },
});

// Clears the "your vote no longer counts" notice by forgetting the dropped rows.
export const dismissDropped = mutation({
  args: {},
  handler: async (ctx) => {
    const participant = await requireParticipant(ctx);
    await deleteUncounted(ctx, await voterBallot(ctx, participant._id));
  },
});

export type ResultRow = {
  submissionId: Id<"submissions">;
  rank: number;
  // Same votes and likes as the row above; order falls back to print code.
  tiedWithPrevious: boolean;
  printCode: string;
  title: string;
  colour?: string;
  stage: EntryStage;
  displayName: string;
  participantName: string;
  participantEmail: string;
  votes: number;
  likes: number;
  skips: number;
};

// Owner only: every entry ranked by votes, then likes, then print code.
export const results = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const { tally, voters } = await tallyVotes(ctx);
    const reactions = await reactionCounts(ctx);
    const rows: Omit<ResultRow, "rank" | "tiedWithPrevious">[] = [];
    for (const s of await listEntries(ctx)) {
      const participant = await ctx.db.get(s.participantId);
      if (!participant) continue;
      rows.push({
        submissionId: s._id,
        printCode: s.printCode,
        title: s.title,
        colour: s.colour,
        stage: entryStage(s.status),
        displayName: participant.displayName,
        participantName: participant.name,
        participantEmail: participant.email,
        votes: tally.get(s._id) ?? 0,
        likes: reactions.get(s._id)?.likes ?? 0,
        skips: reactions.get(s._id)?.skips ?? 0,
      });
    }
    rows.sort(compareRanking);
    const ranked: ResultRow[] = rows.map((row, i) => {
      const prev = rows[i - 1];
      return {
        ...row,
        rank: i + 1,
        tiedWithPrevious: !!prev && prev.votes === row.votes && prev.likes === row.likes,
      };
    });
    const winner = ranked[0] && ranked[0].votes > 0 ? ranked[0] : null;
    const participants = (await ctx.db.query("participants").collect()).length;
    return { rows: ranked, winner, voters: voters.size, participants };
  },
});
