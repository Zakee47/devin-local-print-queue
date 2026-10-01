import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./admins";

// Replaces the allowlist with a freshly parsed Luma CSV (parsed client-side
// with lib/guest-csv.ts). Existing participants are unaffected.
export const importCsv = mutation({
  args: {
    fileName: v.string(),
    rowCount: v.number(),
    hasCheckInColumn: v.boolean(),
    guests: v.array(
      v.object({ email: v.string(), name: v.optional(v.string()), checkedIn: v.boolean() })
    ),
  },
  handler: async (ctx, args) => {
    const uploadedBy = await requireOwner(ctx);
    for (const g of await ctx.db.query("guests").collect()) {
      if (g.manual !== true) await ctx.db.delete(g._id);
    }
    const eligibleCount = args.guests.filter((g) => g.checkedIn).length;
    const importId = await ctx.db.insert("guestImports", {
      fileName: args.fileName,
      uploadedBy,
      rowCount: args.rowCount,
      eligibleCount,
      hasCheckInColumn: args.hasCheckInColumn,
    });
    const seen = new Set<string>();
    for (const g of args.guests) {
      const email = g.email.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      const manual = await ctx.db
        .query("guests")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (manual?.manual === true) {
        await ctx.db.patch(manual._id, {
          checkedIn: true,
          ...(manual.name ? {} : g.name ? { name: g.name } : {}),
        });
        continue;
      }
      await ctx.db.insert("guests", { email, name: g.name, checkedIn: g.checkedIn, importId });
    }
    await ctx.db.insert("auditLog", {
      actor: uploadedBy,
      action: "guests.import",
      detail: `${args.fileName}: ${eligibleCount}/${seen.size} eligible`,
    });
    return { total: seen.size, eligibleCount };
  },
});

// Adds a checked-in guest by hand; upserts an existing row so it stays manual.
export const addGuest = mutation({
  args: { email: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireOwner(ctx);
    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Enter a valid email address");
    const name = args.name?.trim() || undefined;
    const existing = await ctx.db
      .query("guests")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    let id;
    if (existing) {
      await ctx.db.patch(existing._id, {
        checkedIn: true,
        manual: true,
        ...(name ? { name } : {}),
      });
      id = existing._id;
    } else {
      id = await ctx.db.insert("guests", { email, name, checkedIn: true, manual: true });
    }
    await ctx.db.insert("auditLog", { actor, action: "guests.add", detail: email });
    return id;
  },
});

export const removeGuest = mutation({
  args: { id: v.id("guests") },
  handler: async (ctx, { id }) => {
    const actor = await requireOwner(ctx);
    const guest = await ctx.db.get(id);
    if (!guest) throw new Error("Guest not found");
    await ctx.db.delete(id);
    await ctx.db.insert("auditLog", { actor, action: "guests.remove", detail: guest.email });
  },
});

export const latestImport = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.db.query("guestImports").order("desc").first();
  },
});

// Current allowlist with whether each guest has registered as a participant.
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const guests = await ctx.db.query("guests").collect();
    const participants = await ctx.db.query("participants").collect();
    const registered = new Set(participants.map((p) => p.email));
    return guests
      .map((g) => ({ ...g, registered: registered.has(g.email) }))
      .sort((a, b) => a.email.localeCompare(b.email));
  },
});
