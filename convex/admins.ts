import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";

// The signed-in viewer's verified email, lowercased, or null.
export async function viewerEmail(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || identity.emailVerified !== true) return null;
  return identity.email?.trim().toLowerCase() || null;
}

export type AdminRole = "owner" | "staff";

export async function viewerRole(ctx: QueryCtx | MutationCtx): Promise<AdminRole | null> {
  const email = await viewerEmail(ctx);
  if (!email) return null;
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (ownerEmail && email === ownerEmail) return "owner";
  const match = await ctx.db
    .query("admins")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  return match ? "staff" : null;
}

export async function isViewerAdmin(ctx: QueryCtx | MutationCtx) {
  return (await viewerRole(ctx)) !== null;
}

// Returns the admin's email; throws for anyone else.
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const email = await viewerEmail(ctx);
  if (!email) throw new ConvexError("Not authenticated");
  if ((await viewerRole(ctx)) === null) throw new ConvexError("Not an admin");
  return email;
}

export async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const email = await viewerEmail(ctx);
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email || !ownerEmail || email !== ownerEmail) throw new ConvexError("Owner only");
  return email;
}

export const isAdmin = query({
  args: {},
  handler: async (ctx) => isViewerAdmin(ctx),
});

export const role = query({
  args: {},
  handler: async (ctx) => viewerRole(ctx),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.db.query("admins").collect();
  },
});

export const add = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const actor = await requireOwner(ctx);
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) throw new ConvexError("Invalid email");
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (!existing) await ctx.db.insert("admins", { email: normalized, role: "staff" });
    await ctx.db.insert("auditLog", {
      actor,
      action: "admin.add",
      detail: normalized,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("admins") },
  handler: async (ctx, { id }) => {
    const actor = await requireOwner(ctx);
    const admin = await ctx.db.get(id);
    await ctx.db.delete(id);
    await ctx.db.insert("auditLog", {
      actor,
      action: "admin.remove",
      detail: admin?.email ?? String(id),
    });
  },
});
