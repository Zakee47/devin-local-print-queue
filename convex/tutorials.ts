import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { viewerEmail, viewerRole } from "./admins";
import { viewerParticipant } from "./participants";
import { v } from "convex/values";

const tour = v.union(v.literal("participant"), v.literal("staff"));

// The viewer's email if they can take this tour, else null.
async function tourEmail(
  ctx: QueryCtx | MutationCtx,
  tour: "participant" | "staff"
): Promise<string | null> {
  const email = await viewerEmail(ctx);
  if (!email) return null;
  if (tour === "participant") return (await viewerParticipant(ctx)) ? email : null;
  return (await viewerRole(ctx)) !== null ? email : null;
}

export const seen = query({
  args: { tour },
  handler: async (ctx, { tour }) => {
    const email = await tourEmail(ctx, tour);
    if (!email) return null;
    const row = await ctx.db
      .query("tutorialViews")
      .withIndex("by_email_tour", (q) => q.eq("email", email).eq("tour", tour))
      .unique();
    return row !== null;
  },
});

export const markSeen = mutation({
  args: { tour },
  handler: async (ctx, { tour }) => {
    const email = await viewerEmail(ctx);
    if (!email) throw new Error("Not authenticated");
    if (tour === "participant" && !(await viewerParticipant(ctx))) {
      throw new Error("Not registered");
    }
    if (tour === "staff" && (await viewerRole(ctx)) === null) {
      throw new Error("Not an admin");
    }
    const row = await ctx.db
      .query("tutorialViews")
      .withIndex("by_email_tour", (q) => q.eq("email", email).eq("tour", tour))
      .unique();
    if (!row) await ctx.db.insert("tutorialViews", { email, tour, seenAt: Date.now() });
    return null;
  },
});
