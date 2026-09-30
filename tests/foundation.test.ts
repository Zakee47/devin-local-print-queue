/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { DEFAULT_SETTINGS, readSettings } from "../convex/settings";
import { entryFor, listEntries } from "../convex/entries";
import { swatchFor } from "../lib/colours";
import { DEFAULT_MAX_DIMENSIONS_MM, submissionsAreOpen } from "../lib/event";
import { fitsWithin, formatDimensions } from "../lib/dimensions";
import { normalizeUsername, usernameKey, validateUsername } from "../lib/usernames";

const modules = import.meta.glob("../convex/**/*.ts");
const previousOwnerEmail = process.env.OWNER_EMAIL;

afterEach(() => {
  if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = previousOwnerEmail;
});

const identity = (subject: string, email: string) => ({
  subject,
  email,
  emailVerified: true,
});

describe("dimensions", () => {
  test("fits in any orientation and rejects invalid values", () => {
    expect(fitsWithin({ x: 27, y: 51, z: 40 }, DEFAULT_MAX_DIMENSIONS_MM)).toBe(true);
    expect(fitsWithin({ x: 38.5, y: 50, z: 4.5 }, DEFAULT_MAX_DIMENSIONS_MM)).toBe(true);
    expect(fitsWithin({ x: 70, y: 10, z: 10 }, DEFAULT_MAX_DIMENSIONS_MM)).toBe(false);
    expect(fitsWithin({ x: 1, y: 0, z: 1 }, DEFAULT_MAX_DIMENSIONS_MM)).toBe(false);
    expect(fitsWithin({ x: Number.NaN, y: 1, z: 1 }, DEFAULT_MAX_DIMENSIONS_MM)).toBe(false);
    expect(fitsWithin({ x: 1, y: 1, z: 1 }, { x: Number.POSITIVE_INFINITY, y: 60, z: 45 })).toBe(false);
  });

  test("formats dimensions to one decimal place and removes trailing zeroes", () => {
    expect(formatDimensions({ x: 27, y: 51.04, z: 39.96 })).toBe("27 × 51 × 40 mm");
    expect(formatDimensions({ x: 38.55, y: 50, z: 4.5 })).toBe("38.6 × 50 × 4.5 mm");
  });
});

describe("usernames", () => {
  test("normalizes spacing and creates case-insensitive keys", () => {
    expect(normalizeUsername("  Ada \t Lovelace \n")).toBe("Ada Lovelace");
    expect(usernameKey("  ADA   Lovelace ")).toBe("ada lovelace");
  });

  test("validates length, unicode letters and allowed punctuation", () => {
    expect(validateUsername("Élodie D'Å")).toBeNull();
    expect(validateUsername("A")).toMatch(/between 2 and 24/);
    expect(validateUsername("a".repeat(25))).toMatch(/between 2 and 24/);
    expect(validateUsername("Ada 🛠")).toMatch(/only contain/);
  });
});

describe("submission windows", () => {
  test("respects the open flag and an optional exclusive deadline", () => {
    expect(submissionsAreOpen({ submissionsOpen: true }, 100)).toBe(true);
    expect(submissionsAreOpen({ submissionsOpen: false }, 100)).toBe(false);
    expect(submissionsAreOpen({ submissionsOpen: true, submissionsDeadline: 101 }, 100)).toBe(true);
    expect(submissionsAreOpen({ submissionsOpen: true, submissionsDeadline: 100 }, 100)).toBe(false);
  });
});

test("maps printer palette colours to their swatches", () => {
  expect(swatchFor("Silver")).toBe("#c0c4c8");
  expect(swatchFor("Gold")).toBe("#d4a93a");
  expect(swatchFor("Sea Green")).toBe("#2e8b57");
  expect(swatchFor("Sky Blue")).toBe("#6ec3f4");
});

describe("admin roles and settings permissions", () => {
  test("distinguishes owner, staff and stranger; staff cannot manage admins", async () => {
    process.env.OWNER_EMAIL = " OWNER@example.com ";
    const t = convexTest(schema, modules);
    const staffId = await t.run((ctx) => ctx.db.insert("admins", { email: "staff@example.com" }));
    const owner = t.withIdentity(identity("owner", "owner@example.com"));
    const staff = t.withIdentity(identity("staff", "staff@example.com"));
    const stranger = t.withIdentity(identity("stranger", "stranger@example.com"));

    expect(await owner.query(api.admins.role, {})).toBe("owner");
    expect(await staff.query(api.admins.role, {})).toBe("staff");
    expect(await stranger.query(api.admins.role, {})).toBeNull();
    expect(await owner.query(api.admins.isAdmin, {})).toBe(true);
    await expect(staff.query(api.admins.list, {})).rejects.toThrow("Owner only");
    await expect(staff.mutation(api.admins.add, { email: "new@example.com" })).rejects.toThrow("Owner only");
    await expect(staff.mutation(api.admins.remove, { id: staffId })).rejects.toThrow("Owner only");
    await expect(stranger.mutation(api.admins.remove, { id: staffId })).rejects.toThrow("Owner only");

    await owner.mutation(api.admins.add, { email: " New@Example.com " });
    const newAdmin = await t.run((ctx) =>
      ctx.db.query("admins").withIndex("by_email", (q) => q.eq("email", "new@example.com")).unique()
    );
    expect(newAdmin?.role).toBe("staff");
    await owner.mutation(api.admins.remove, { id: newAdmin!._id });
    const logs = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(logs.map(({ actor, action }) => [actor, action])).toEqual([
      ["owner@example.com", "admin.add"],
      ["owner@example.com", "admin.remove"],
    ]);
  });

  test("staff may update intake settings but not voting or TV results", async () => {
    process.env.OWNER_EMAIL = "owner@example.com";
    const t = convexTest(schema, modules);
    await t.run((ctx) => ctx.db.insert("admins", { email: "staff@example.com" }));
    const staff = t.withIdentity(identity("staff", "staff@example.com"));
    await staff.mutation(api.settings.update, {
      submissionsDeadline: 1234,
      announcement: "  Doors open soon  ",
      maxDimensionsMm: { x: 60, y: 60, z: 45 },
      printers: [
        { name: " Creality ", colours: [" Black ", "Black", ""] },
        { name: "creality", colours: ["Silver"] },
        { name: " ", colours: ["Gold"] },
      ],
    });
    let settings = await staff.query(api.settings.get, {});
    expect(settings).toMatchObject({
      submissionsDeadline: 1234,
      announcement: "  Doors open soon  ",
      printers: [{ name: "Creality", colours: ["Black"] }],
    });
    expect(settings).not.toHaveProperty("nextPrintNumber");
    await expect(staff.mutation(api.settings.update, { votingOpen: false })).rejects.toThrow("Owner only");
    await expect(staff.mutation(api.settings.update, { showResultsOnTv: true })).rejects.toThrow("Owner only");

    await staff.mutation(api.settings.update, { submissionsDeadline: null, announcement: "" });
    settings = await staff.query(api.settings.get, {});
    expect(settings.submissionsDeadline).toBeUndefined();
    expect(settings.announcement).toBeUndefined();
  });

  test("owner email is the only owner and can be absent", async () => {
    delete process.env.OWNER_EMAIL;
    const t = convexTest(schema, modules);
    const viewer = t.withIdentity(identity("viewer", "viewer@example.com"));
    expect(await viewer.query(api.admins.role, {})).toBeNull();
  });
});

describe("participant registration", () => {
  test("requires unique usernames and rejects blocked email addresses", async () => {
    const t = convexTest(schema, modules);
    const importId = await t.run((ctx) =>
      ctx.db.insert("guestImports", {
        fileName: "test.csv",
        uploadedBy: "test",
        rowCount: 2,
        eligibleCount: 2,
        hasCheckInColumn: true,
      })
    );
    await t.run(async (ctx) => {
      for (const email of ["ada@example.com", "grace@example.com"]) {
        await ctx.db.insert("guests", { email, checkedIn: true, importId });
      }
      await ctx.db.insert("blockedEmails", {
        email: "blocked@example.com",
        reason: "Removed",
        blockedBy: "owner@example.com",
      });
    });
    const ada = t.withIdentity(identity("ada", "ada@example.com"));
    const grace = t.withIdentity(identity("grace", "grace@example.com"));
    const blocked = t.withIdentity(identity("blocked", "blocked@example.com"));

    await expect(ada.mutation(api.participants.register, { username: "A" })).rejects.toThrow(
      /between 2 and 24/
    );
    const id = await ada.mutation(api.participants.register, { username: "  Ada   Lovelace " });
    expect(
      await t.run((ctx) => ctx.db.get(id))
    ).toMatchObject({ name: "ada", displayName: "Ada Lovelace", usernameKey: "ada lovelace" });
    await expect(grace.mutation(api.participants.register, { username: "ADA LOVELACE" })).rejects.toThrow(
      "That username is taken"
    );
    await expect(blocked.mutation(api.participants.register, { username: "Blocked User" })).rejects.toThrow(
      "This account has been removed by the organisers"
    );
    expect(await blocked.query(api.participants.viewerStatus, {})).toEqual({
      state: "blocked",
      email: "blocked@example.com",
    });

    await ada.mutation(api.participants.setUsername, { username: "Ada L." });
    await expect(grace.mutation(api.participants.register, { username: "ada l." })).rejects.toThrow(
      "That username is taken"
    );
    expect(await ada.mutation(api.participants.register, { username: "!" })).toBe(id);
  });
});

describe("settings and design entries", () => {
  test("merges default dimensions, printers and voting state into a legacy settings row", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("settings", {
        submissionsOpen: true,
        votingOpen: false,
        showResultsOnTv: false,
        maxFileBytes: 123,
        colours: ["Red"],
        nextPrintNumber: 9,
      })
    );
    const settings = await t.run((ctx) => readSettings(ctx));
    expect(settings).toMatchObject({
      votingOpen: false,
      maxFileBytes: 123,
      colours: ["Red"],
      maxDimensionsMm: DEFAULT_SETTINGS.maxDimensionsMm,
      printers: DEFAULT_SETTINGS.printers,
    });
    expect(DEFAULT_SETTINGS.votingOpen).toBe(true);
    const publicSettings = await t.query(api.settings.get, {});
    expect(publicSettings).toHaveProperty("submissionsAcceptingNow", true);
    expect(publicSettings).not.toHaveProperty("nextPrintNumber");
  });

  test("entry helpers exclude rejected and unrequested submissions", async () => {
    const t = convexTest(schema, modules);
    const { first, second, participantId } = await t.run(async (ctx) => {
      const people = await Promise.all(
        ["ada", "grace"].map((name) =>
          ctx.db.insert("participants", {
            clerkUserId: name,
            email: `${name}@example.com`,
            name,
            displayName: name,
          })
        )
      );
      const storageId = await ctx.storage.store(new Blob(["solid x"]));
      const insert = (participantId: Id<"participants">, printCode: string, printRequested: boolean, status: "submitted" | "rejected") =>
        ctx.db.insert("submissions", {
          participantId,
          storageId,
          originalFileName: `${printCode}.stl`,
          kind: "stl" as const,
          sizeBytes: 1,
          title: printCode,
          printRequested,
          status,
          printCode,
        });
      const first = await insert(people[0], "KC-003", true, "submitted");
      await insert(people[0], "KC-001", true, "rejected");
      await insert(people[0], "KC-002", false, "submitted");
      const second = await insert(people[1], "KC-004", true, "submitted");
      return { first, second, participantId: people[0] };
    });
    expect(await t.run((ctx) => entryFor(ctx, participantId))).toMatchObject({ _id: first });
    expect((await t.run((ctx) => listEntries(ctx))).map(({ _id }) => _id)).toEqual([first, second]);
  });
});
