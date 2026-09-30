import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

// The signed-in viewer's verified email, lowercased, or null.
export async function viewerEmail(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || identity.emailVerified !== true) return null;
  return identity.email?.trim().toLowerCase() || null;
}

export async function isViewerAdmin(ctx: QueryCtx | MutationCtx) {
  const email = await viewerEmail(ctx);
  if (!email) return false;
  const match = await ctx.db
    .query("admins")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  return match !== null;
}

// Returns the admin's email; throws for anyone else.
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const email = await viewerEmail(ctx);
  if (!email) throw new Error("Not authenticated");
  if (!(await isViewerAdmin(ctx))) throw new Error("Not an admin");
  return email;
}

export const isAdmin = query({
  args: {},
  handler: async (ctx) => isViewerAdmin(ctx),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("admins").collect();
  },
});

export const add = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await requireAdmin(ctx);
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) throw new Error("Invalid email");
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (!existing) await ctx.db.insert("admins", { email: normalized });
  },
});

export const remove = mutation({
  args: { id: v.id("admins") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("admins").collect();
    if (all.length <= 1) throw new Error("Can't remove the last admin");
    await ctx.db.delete(id);
  },
});
