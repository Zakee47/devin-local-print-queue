import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { DEFAULT_SETTINGS } from "../convex/settings";

const modules = import.meta.glob("../convex/**/*.ts");

const identityFor = (who: string) => ({
  subject: `user-${who}`,
  email: `${who}@example.com`,
  emailVerified: true,
});

async function setup({ votingOpen = false }: { votingOpen?: boolean } = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, votingOpen });
    const storageId = await ctx.storage.store(new Blob(["solid x\nendsolid x\n"]));
    const people: Record<string, Id<"participants">> = {};
    for (const who of ["ada", "grace"]) {
      people[who] = await ctx.db.insert("participants", {
        clerkUserId: `user-${who}`,
        email: `${who}@example.com`,
        name: who,
        displayName: who,
      });
    }
    const submit = (owner: string, status: "done" | "queued", n: number) =>
      ctx.db.insert("submissions", {
        participantId: people[owner],
        storageId,
        originalFileName: `${owner}.stl`,
        kind: "stl",
        sizeBytes: 20,
        title: `${owner} ${status}`,
        printRequested: true,
        status,
        printCode: `KC-00${n}`,
      });
    return {
      ada: await submit("ada", "done", 1),
      grace: await submit("grace", "done", 2),
      queued: await submit("grace", "queued", 3),
    };
  });
  return { t, ...ids };
}

describe("likes", () => {
  it("upserts a reaction and clears it on undo, even while voting is closed", async () => {
    const { t, grace } = await setup({ votingOpen: false });
    const ada = t.withIdentity(identityFor("ada"));
    await ada.mutation(api.likes.react, { submissionId: grace, reaction: "like" });
    expect(await ada.query(api.likes.mine)).toEqual([{ submissionId: grace, reaction: "like" }]);

    await ada.mutation(api.likes.react, { submissionId: grace, reaction: "skip" });
    expect(await ada.query(api.likes.mine)).toEqual([{ submissionId: grace, reaction: "skip" }]);
    const rows = await t.run((ctx) => ctx.db.query("likes").collect());
    expect(rows).toHaveLength(1);

    await ada.mutation(api.likes.clearReaction, { submissionId: grace });
    expect(await ada.query(api.likes.mine)).toEqual([]);
    // Clearing again is a no-op.
    await ada.mutation(api.likes.clearReaction, { submissionId: grace });
  });

  it("rejects liking your own entry", async () => {
    const { t, ada } = await setup();
    await expect(
      t.withIdentity(identityFor("ada")).mutation(api.likes.react, { submissionId: ada, reaction: "like" })
    ).rejects.toThrow(/own entry/);
  });

  it("only allows reacting to done submissions", async () => {
    const { t, queued } = await setup();
    await expect(
      t.withIdentity(identityFor("ada")).mutation(api.likes.react, { submissionId: queued, reaction: "like" })
    ).rejects.toThrow(/printed entries/);
  });

  it("requires a registered participant", async () => {
    const { t, grace } = await setup();
    await expect(t.mutation(api.likes.react, { submissionId: grace, reaction: "like" })).rejects.toThrow(
      /Not registered/
    );
    await expect(
      t.withIdentity(identityFor("stranger")).mutation(api.likes.clearReaction, { submissionId: grace })
    ).rejects.toThrow(/Not registered/);
    expect(await t.query(api.likes.mine)).toBeNull();
  });
});
