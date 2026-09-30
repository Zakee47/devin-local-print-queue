import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Local-dev bootstrap: `npx convex run seed:dev '{"adminEmail":"you@x.com"}'`
// Adds an admin and a few checked-in mock guests (stands in for a Luma CSV).
export const dev = internalMutation({
  args: { adminEmail: v.optional(v.string()) },
  handler: async (ctx, { adminEmail }) => {
    const emails = [
      adminEmail,
      "devin-test@agentmail.to",
      "ada@example.com",
      "grace@example.com",
    ].filter((e): e is string => !!e);
    if (adminEmail) {
      const email = adminEmail.toLowerCase();
      const existing = await ctx.db
        .query("admins")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (!existing) await ctx.db.insert("admins", { email, role: "staff" });
    }
    const importId = await ctx.db.insert("guestImports", {
      fileName: "seed",
      uploadedBy: "seed",
      rowCount: emails.length,
      eligibleCount: emails.length,
      hasCheckInColumn: true,
    });
    for (const raw of emails) {
      const email = raw.toLowerCase();
      const existing = await ctx.db
        .query("guests")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (!existing) await ctx.db.insert("guests", { email, checkedIn: true, importId });
    }
  },
});
