import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { viewerEmail } from "./admins";
import { displayNameFrom } from "../lib/files";

export async function eligibleGuest(ctx: QueryCtx | MutationCtx, email: string) {
  const guest = await ctx.db
    .query("guests")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  return guest && guest.checkedIn ? guest : null;
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
  if (!participant) throw new Error("Not registered");
  return participant;
}

export type ViewerStatus =
  | { state: "signed_out" }
  | { state: "unverified" }
  | { state: "not_on_guest_list"; email: string }
  | { state: "eligible"; email: string }
  | { state: "registered"; email: string; displayName: string };

// Drives the participant landing page: whether the signed-in email is on the
// checked-in Luma list and whether they've already registered.
export const viewerStatus = query({
  args: {},
  handler: async (ctx): Promise<ViewerStatus> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { state: "signed_out" };
    const email = await viewerEmail(ctx);
    if (!email) return { state: "unverified" };
    const participant = await viewerParticipant(ctx);
    if (participant) {
      return { state: "registered", email, displayName: participant.displayName };
    }
    if (!(await eligibleGuest(ctx, email))) return { state: "not_on_guest_list", email };
    return { state: "eligible", email };
  },
});

// Idempotent. Only checked-in guests from the latest CSV can register. An
// existing participant stays registered even if a later CSV drops them.
export const register = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const email = await viewerEmail(ctx);
    if (!email) throw new Error("Verify your email first");
    const existing = await viewerParticipant(ctx);
    if (existing) return existing._id;
    const guest = await eligibleGuest(ctx, email);
    if (!guest) throw new Error("This email isn't on the checked-in guest list");
    const sameEmail = await ctx.db
      .query("participants")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (sameEmail) throw new Error("This email is already registered to another account");
    const name = guest.name || identity.name || email.split("@")[0];
    return await ctx.db.insert("participants", {
      clerkUserId: identity.subject,
      email,
      name,
      displayName: displayNameFrom(name),
    });
  },
});
