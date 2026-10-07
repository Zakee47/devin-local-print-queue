import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { viewerEmail, viewerRole } from "./admins";
import { normalizeUsername, usernameKey, validateUsername } from "../lib/usernames";
import { ConvexError, v } from "convex/values";

export async function eligibleGuest(ctx: QueryCtx | MutationCtx, email: string) {
  const guest = await ctx.db
    .query("guests")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  return guest ?? null;
}

// The viewer's participant row, or null if they haven't registered.
export async function viewerParticipant(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("participants")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
}

export async function requireParticipant(ctx: QueryCtx | MutationCtx) {
  const participant = await viewerParticipant(ctx);
  if (!participant) throw new ConvexError("Not registered");
  return participant;
}

export type ViewerStatus =
  | { state: "signed_out" }
  | { state: "unverified" }
  | { state: "not_on_guest_list"; email: string }
  | { state: "blocked"; email: string }
  | { state: "eligible"; email: string }
  | {
      state: "registered";
      email: string;
      displayName: string;
      playbookStepDone: boolean;
    };

// Drives the participant landing page: whether the signed-in email is on the
// Luma guest list and whether they've already registered.
export const viewerStatus = query({
  args: {},
  handler: async (ctx): Promise<ViewerStatus> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { state: "signed_out" };
    const email = await viewerEmail(ctx);
    if (!email) return { state: "unverified" };
    const participant = await viewerParticipant(ctx);
    if (participant) {
      return {
        state: "registered",
        email,
        displayName: participant.displayName,
        playbookStepDone: participant.playbookStepDoneAt !== undefined,
      };
    }
    const blocked = await ctx.db
      .query("blockedEmails")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (blocked) return { state: "blocked", email };
    if (!(await eligibleGuest(ctx, email)) && (await viewerRole(ctx)) === null) {
      return { state: "not_on_guest_list", email };
    }
    return { state: "eligible", email };
  },
});

// Idempotent. Guest-list members and admin team members can register. An
// existing participant stays registered even if a later CSV drops them.
export const register = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const email = await viewerEmail(ctx);
    if (!email) throw new ConvexError("Verify your email first");
    const existing = await viewerParticipant(ctx);
    if (existing) return existing._id;
    const validationError = validateUsername(username);
    if (validationError) throw new ConvexError(validationError);
    const blocked = await ctx.db
      .query("blockedEmails")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (blocked) throw new ConvexError("This account has been removed by the organisers");
    const normalizedUsername = normalizeUsername(username);
    const key = usernameKey(normalizedUsername);
    const taken = await ctx.db
      .query("participants")
      .withIndex("by_usernameKey", (q) => q.eq("usernameKey", key))
      .unique();
    if (taken) throw new ConvexError("That username is taken");
    const guest = await eligibleGuest(ctx, email);
    if (!guest && (await viewerRole(ctx)) === null) {
      throw new ConvexError("This email isn't on the guest list");
    }
    const sameEmail = await ctx.db
      .query("participants")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (sameEmail) throw new ConvexError("This email is already registered to another account");
    const name = guest?.name || identity.name || email.split("@")[0];
    return await ctx.db.insert("participants", {
      clerkUserId: identity.subject,
      email,
      name,
      displayName: normalizedUsername,
      usernameKey: key,
    });
  },
});

export const completePlaybookStep = mutation({
  args: {},
  handler: async (ctx) => {
    const participant = await requireParticipant(ctx);
    if (participant.playbookStepDoneAt !== undefined) return;
    await ctx.db.patch(participant._id, { playbookStepDoneAt: Date.now() });
  },
});

export const setUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const participant = await requireParticipant(ctx);
    const validationError = validateUsername(username);
    if (validationError) throw new ConvexError(validationError);
    const normalizedUsername = normalizeUsername(username);
    const key = usernameKey(normalizedUsername);
    const taken = await ctx.db
      .query("participants")
      .withIndex("by_usernameKey", (q) => q.eq("usernameKey", key))
      .unique();
    if (taken && taken._id !== participant._id) throw new ConvexError("That username is taken");
    await ctx.db.patch(participant._id, { displayName: normalizedUsername, usernameKey: key });
  },
});
