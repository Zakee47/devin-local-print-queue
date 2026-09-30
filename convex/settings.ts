import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./admins";
import { DEFAULT_COLOURS, DEFAULT_MAX_FILE_BYTES } from "../lib/event";

export type Settings = Omit<Doc<"settings">, "_id" | "_creationTime">;

export const DEFAULT_SETTINGS: Settings = {
  submissionsOpen: true,
  votingOpen: false,
  showResultsOnTv: false,
  maxFileBytes: DEFAULT_MAX_FILE_BYTES,
  colours: DEFAULT_COLOURS,
  nextPrintNumber: 1,
};

export async function readSettings(ctx: QueryCtx | MutationCtx): Promise<Settings> {
  const row = await ctx.db.query("settings").first();
  if (!row) return DEFAULT_SETTINGS;
  const { _id, _creationTime, ...rest } = row;
  void _id;
  void _creationTime;
  return rest;
}

async function writeSettings(ctx: MutationCtx, patch: Partial<Settings>) {
  const row = await ctx.db.query("settings").first();
  if (row) await ctx.db.patch(row._id, patch);
  else await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, ...patch });
}

// Allocates the next sequential print code number.
export async function takePrintNumber(ctx: MutationCtx) {
  const { nextPrintNumber } = await readSettings(ctx);
  await writeSettings(ctx, { nextPrintNumber: nextPrintNumber + 1 });
  return nextPrintNumber;
}

// Public: participants, the TV and the vote page all read these flags.
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { nextPrintNumber, ...publicSettings } = await readSettings(ctx);
    void nextPrintNumber;
    return publicSettings;
  },
});

export const update = mutation({
  args: {
    submissionsOpen: v.optional(v.boolean()),
    votingOpen: v.optional(v.boolean()),
    showResultsOnTv: v.optional(v.boolean()),
    maxFileBytes: v.optional(v.number()),
    colours: v.optional(v.array(v.string())),
  },
  handler: async (ctx, patch) => {
    const actor = await requireAdmin(ctx);
    if (patch.colours) {
      patch.colours = [...new Set(patch.colours.map((c) => c.trim()).filter(Boolean))];
    }
    await writeSettings(ctx, patch);
    await ctx.db.insert("auditLog", {
      actor,
      action: "settings.update",
      detail: JSON.stringify(patch),
    });
  },
});
