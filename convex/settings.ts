import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { requireAdmin, requireOwner } from "./admins";
import {
  DEFAULT_COLOURS,
  DEFAULT_MAX_DIMENSIONS_MM,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_PRINTERS,
  MAX_BLAST_MESSAGE_LENGTH,
  submissionsAreOpen,
  type ColourCode,
  type Dimensions,
  type Printer,
} from "../lib/event";

export type Settings = Omit<
  Doc<"settings">,
  "_id" | "_creationTime" | "maxDimensionsMm" | "printers" | "colourCodes" | "keepVotesOnReplace"
> & {
  maxDimensionsMm: Dimensions;
  printers: Printer[];
  colourCodes: ColourCode[];
  keepVotesOnReplace: boolean;
};

export type TvView = NonNullable<Doc<"settings">["tvDefaultView"]>;

export const DEFAULT_SETTINGS: Settings = {
  submissionsOpen: false,
  votingOpen: false,
  keepVotesOnReplace: false,
  showResultsOnTv: false,
  maxFileBytes: DEFAULT_MAX_FILE_BYTES,
  colours: DEFAULT_COLOURS,
  colourCodes: [],
  nextPrintNumber: 1,
  maxDimensionsMm: DEFAULT_MAX_DIMENSIONS_MM,
  printers: DEFAULT_PRINTERS,
};

export async function readSettings(ctx: QueryCtx | MutationCtx): Promise<Settings> {
  const row = await ctx.db.query("settings").first();
  if (!row) return DEFAULT_SETTINGS;
  const { _id, _creationTime, ...rest } = row;
  void _id;
  void _creationTime;
  return { ...DEFAULT_SETTINGS, ...rest, keepVotesOnReplace: rest.keepVotesOnReplace ?? false };
}

async function writeSettings(ctx: MutationCtx, patch: Partial<Settings>) {
  const row = await ctx.db.query("settings").first();
  if (row) await ctx.db.patch(row._id, patch);
  else {
    const initialSettings = { ...DEFAULT_SETTINGS, ...patch };
    if (initialSettings.submissionsDeadline === undefined) delete initialSettings.submissionsDeadline;
    if (initialSettings.announcement === undefined) delete initialSettings.announcement;
    if (initialSettings.announcementUpdatedAt === undefined) delete initialSettings.announcementUpdatedAt;
    if (initialSettings.submissionsOpenedAt === undefined) delete initialSettings.submissionsOpenedAt;
    if (initialSettings.votingOpenedAt === undefined) delete initialSettings.votingOpenedAt;
    await ctx.db.insert("settings", initialSettings);
  }
}

// One-off per event; not exposed in the Settings UI.
export const setKeepVotesOnReplace = internalMutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    await writeSettings(ctx, { keepVotesOnReplace: enabled });
  },
});

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
    return {
      ...publicSettings,
      submissionsAcceptingNow: submissionsAreOpen(publicSettings, Date.now()),
    };
  },
});

export const update = mutation({
  args: {
    submissionsOpen: v.optional(v.boolean()),
    votingOpen: v.optional(v.boolean()),
    showResultsOnTv: v.optional(v.boolean()),
    maxFileBytes: v.optional(v.number()),
    colours: v.optional(v.array(v.string())),
    colourCodes: v.optional(v.array(v.object({ name: v.string(), hex: v.string() }))),
    submissionsDeadline: v.optional(v.union(v.number(), v.null())),
    announcement: v.optional(v.union(v.string(), v.null())),
    maxDimensionsMm: v.optional(v.object({ x: v.number(), y: v.number(), z: v.number() })),
    printers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          colours: v.array(v.string()),
          outOfService: v.optional(v.boolean()),
        })
      )
    ),
    tvDefaultView: v.optional(v.union(v.literal("main"), v.literal("projects"))),
  },
  handler: async (ctx, patch) => {
    const actor = await requireAdmin(ctx);
    const currentSettings = await readSettings(ctx);
    if (
      patch.votingOpen !== undefined ||
      patch.showResultsOnTv !== undefined ||
      patch.tvDefaultView !== undefined
    ) {
      await requireOwner(ctx);
    }
    const { submissionsDeadline, announcement, ...rest } = patch;
    const settingsPatch: Partial<Settings> = { ...rest };
    if (
      currentSettings.submissionsOpenedAt === undefined &&
      (patch.submissionsOpen === true || currentSettings.submissionsOpen === true)
    ) {
      settingsPatch.submissionsOpenedAt = Date.now();
    }
    if (
      currentSettings.votingOpenedAt === undefined &&
      (patch.votingOpen === true || currentSettings.votingOpen === true)
    ) {
      settingsPatch.votingOpenedAt = Date.now();
    }
    if (submissionsDeadline === null) settingsPatch.submissionsDeadline = undefined;
    else if (submissionsDeadline !== undefined) settingsPatch.submissionsDeadline = submissionsDeadline;
    if (announcement === null || announcement === "") {
      settingsPatch.announcement = undefined;
      settingsPatch.announcementUpdatedAt = undefined;
    } else if (announcement !== undefined) {
      if (announcement.length > MAX_BLAST_MESSAGE_LENGTH) {
        throw new ConvexError("Blast message must be 280 characters or fewer");
      }
      settingsPatch.announcement = announcement;
      if (announcement !== currentSettings.announcement) {
        settingsPatch.announcementUpdatedAt = Date.now();
      }
    }
    if (settingsPatch.colours !== undefined) {
      settingsPatch.colours = [...new Set(settingsPatch.colours.map((c) => c.trim()).filter(Boolean))];
    }
    if (settingsPatch.printers !== undefined) {
      const printerNames = new Set<string>();
      settingsPatch.printers = settingsPatch.printers.flatMap(({ name, colours, outOfService }) => {
        const trimmedName = name.trim();
        const nameKey = trimmedName.toLowerCase();
        if (!trimmedName || printerNames.has(nameKey)) return [];
        printerNames.add(nameKey);
        const seenColours = new Set<string>();
        const cleanColours = colours.flatMap((colour) => {
          const trimmedColour = colour.trim();
          const key = trimmedColour.toLowerCase();
          if (!trimmedColour || seenColours.has(key)) return [];
          seenColours.add(key);
          return [trimmedColour];
        });
        return [{ name: trimmedName, colours: cleanColours, ...(outOfService === undefined ? {} : { outOfService }) }];
      });
    }
    if (patch.colourCodes !== undefined || patch.colours !== undefined) {
      const palette = settingsPatch.colours ?? currentSettings.colours;
      const paletteNames = new Set(palette.map((colour) => colour.trim().toLowerCase()));
      const codes = patch.colourCodes ?? currentSettings.colourCodes;
      const byName = new Map<string, ColourCode>();
      for (const code of codes) {
        if (patch.colourCodes !== undefined && !/^#[0-9a-f]{6}$/i.test(code.hex)) {
          throw new ConvexError(`Invalid colour code for "${code.name}": use a 6-digit hex value such as #b3152f`);
        }
        const name = code.name.trim();
        if (name) byName.set(name.toLowerCase(), { name, hex: code.hex.toLowerCase() });
      }
      settingsPatch.colourCodes = [...byName.values()].filter((code) =>
        paletteNames.has(code.name.toLowerCase())
      );
    }
    await writeSettings(ctx, settingsPatch);
    await ctx.db.insert("auditLog", {
      actor,
      action: "settings.update",
      detail: JSON.stringify(patch),
    });
  },
});
