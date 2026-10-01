import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireOwner } from "./admins";
import { entryFor } from "./entries";
import { normalizeUsername, usernameKey, validateUsername } from "../lib/usernames";

// Owner-only account administration: staff list, participant details, blocks.

export const team = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireOwner(ctx);
    const staff = (await ctx.db.query("admins").collect()).sort((a, b) =>
      a.email.localeCompare(b.email)
    );
    return { ownerEmail: actor, staff };
  },
});

export const listParticipants = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const participants = await ctx.db.query("participants").collect();
    participants.sort((a, b) => b._creationTime - a._creationTime);
    return await Promise.all(
      participants.map(async (participant) => {
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
          .collect();
        const entry = await entryFor(ctx, participant._id);
        const votesCast = (
          await ctx.db
            .query("votes")
            .withIndex("by_voter", (q) => q.eq("voterId", participant._id))
            .collect()
        ).length;
        const votesReceived = entry
          ? (
              await ctx.db
                .query("votes")
                .withIndex("by_submission", (q) => q.eq("submissionId", entry._id))
                .collect()
            ).length
          : 0;
        const likesReceived = entry
          ? (
              await ctx.db
                .query("likes")
                .withIndex("by_submission", (q) => q.eq("submissionId", entry._id))
                .collect()
            ).filter((like) => like.reaction === "like").length
          : 0;
        return {
          _id: participant._id,
          username: participant.displayName,
          name: participant.name,
          email: participant.email,
          registeredAt: participant._creationTime,
          entry: entry
            ? { printCode: entry.printCode, title: entry.title, status: entry.status }
            : null,
          uploadCount: submissions.length,
          votesCast,
          votesReceived,
          likesReceived,
        };
      })
    );
  },
});

export const renameParticipant = mutation({
  args: { participantId: v.id("participants"), username: v.string() },
  handler: async (ctx, { participantId, username }) => {
    const actor = await requireOwner(ctx);
    const participant = await ctx.db.get(participantId);
    if (!participant) throw new ConvexError("Participant not found");
    const validationError = validateUsername(username);
    if (validationError) throw new ConvexError(validationError);
    const normalized = normalizeUsername(username);
    const key = usernameKey(normalized);
    const taken = await ctx.db
      .query("participants")
      .withIndex("by_usernameKey", (q) => q.eq("usernameKey", key))
      .unique();
    if (taken && taken._id !== participant._id) throw new ConvexError("That username is taken");
    await ctx.db.patch(participantId, { displayName: normalized, usernameKey: key });
    await ctx.db.insert("auditLog", {
      actor,
      action: "participant.rename",
      detail: `${participant.email}: ${participant.displayName} -> ${normalized}`,
    });
  },
});

export const deleteParticipant = mutation({
  args: {
    participantId: v.id("participants"),
    block: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { participantId, block, reason }) => {
    const actor = await requireOwner(ctx);
    const participant = await ctx.db.get(participantId);
    if (!participant) throw new ConvexError("Participant not found");

    const deleted = new Set<string>();
    const remove = async (id: Parameters<typeof ctx.db.delete>[0]) => {
      if (deleted.has(id)) return;
      if (await ctx.db.get(id)) {
        await ctx.db.delete(id);
        deleted.add(id);
      }
    };

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_participant", (q) => q.eq("participantId", participantId))
      .collect();
    const doomedSubmissionIds = new Set<string>(submissions.map((s) => s._id));
    // Only delete a blob when no submission outside the ones being removed
    // still references it (blobs can be shared).
    const referencedElsewhere = new Set<string>();
    for (const other of await ctx.db.query("submissions").collect()) {
      if (!doomedSubmissionIds.has(other._id)) {
        referencedElsewhere.add(other.storageId);
        if (other.previewStorageId) referencedElsewhere.add(other.previewStorageId);
      }
    }
    const removedStorage = new Set<string>();
    const removedVotes = new Set<string>();
    const removedLikes = new Set<string>();
    for (const submission of submissions) {
      for (const vote of await ctx.db
        .query("votes")
        .withIndex("by_submission", (q) => q.eq("submissionId", submission._id))
        .collect()) {
        await remove(vote._id);
        removedVotes.add(vote._id);
      }
      for (const like of await ctx.db
        .query("likes")
        .withIndex("by_submission", (q) => q.eq("submissionId", submission._id))
        .collect()) {
        await remove(like._id);
        removedLikes.add(like._id);
      }
      if (
        !referencedElsewhere.has(submission.storageId) &&
        !removedStorage.has(submission.storageId) &&
        (await ctx.db.system.get("_storage", submission.storageId))
      ) {
        await ctx.storage.delete(submission.storageId);
        removedStorage.add(submission.storageId);
      }
      if (
        submission.previewStorageId &&
        submission.previewStorageId !== submission.storageId &&
        !referencedElsewhere.has(submission.previewStorageId) &&
        !removedStorage.has(submission.previewStorageId) &&
        (await ctx.db.system.get("_storage", submission.previewStorageId))
      ) {
        await ctx.storage.delete(submission.previewStorageId);
        removedStorage.add(submission.previewStorageId);
      }
      await remove(submission._id);
    }
    for (const vote of await ctx.db
      .query("votes")
      .withIndex("by_voter", (q) => q.eq("voterId", participantId))
      .collect()) {
      await remove(vote._id);
      removedVotes.add(vote._id);
    }
    for (const like of await ctx.db
      .query("likes")
      .withIndex("by_participant", (q) => q.eq("participantId", participantId))
      .collect()) {
      await remove(like._id);
      removedLikes.add(like._id);
    }
    await remove(participantId);

    if (block) {
      const email = participant.email.trim().toLowerCase();
      const existing = await ctx.db
        .query("blockedEmails")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (!existing) {
        await ctx.db.insert("blockedEmails", {
          email,
          reason: reason?.trim() || undefined,
          blockedBy: actor,
        });
      }
    }

    await ctx.db.insert("auditLog", {
      actor,
      action: "participant.delete",
      detail: `${participant.displayName} (${participant.email})${block ? " (blocked)" : ""}`,
    });
    return {
      submissions: submissions.length,
      votes: removedVotes.size,
      likes: removedLikes.size,
    };
  },
});

export const listBlocked = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const rows = await ctx.db.query("blockedEmails").collect();
    return rows.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const unblock = mutation({
  args: { id: v.id("blockedEmails") },
  handler: async (ctx, { id }) => {
    const actor = await requireOwner(ctx);
    const row = await ctx.db.get(id);
    await ctx.db.delete(id);
    await ctx.db.insert("auditLog", {
      actor,
      action: "blocked.remove",
      detail: row?.email ?? String(id),
    });
  },
});
