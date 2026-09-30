import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { MAX_VOTES_PER_PARTICIPANT } from "../lib/event";
import { DEFAULT_SETTINGS } from "../convex/settings";

const modules = import.meta.glob("../convex/**/*.ts");

const identityFor = (who: string) => ({
  subject: `user-${who}`,
  email: `${who}@example.com`,
  emailVerified: true,
});

type Status = "submitted" | "rejected" | "queued" | "printing" | "done";

async function setup({ votingOpen = true }: { votingOpen?: boolean } = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("admins", { email: "admin@example.com" });
    await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, votingOpen });
    const storageId = await ctx.storage.store(new Blob(["solid x\nendsolid x\n"]));
    const people: Record<string, Id<"participants">> = {};
    for (const who of ["ada", "grace", "alan", "linus"]) {
      people[who] = await ctx.db.insert("participants", {
        clerkUserId: `user-${who}`,
        email: `${who}@example.com`,
        name: who[0].toUpperCase() + who.slice(1) + " Test",
        displayName: who[0].toUpperCase() + who.slice(1) + " T.",
      });
    }
    let n = 1;
    const submit = (owner: string, status: Status) =>
      ctx.db.insert("submissions", {
        participantId: people[owner],
        storageId,
        originalFileName: `${owner}.stl`,
        kind: "stl",
        sizeBytes: 20,
        title: `${owner} ${status}`,
        colour: "Red",
        printRequested: true,
        status,
        printCode: `KC-00${n++}`,
      });
    return {
      people,
      ada: await submit("ada", "done"),
      grace: await submit("grace", "done"),
      alan: await submit("alan", "done"),
      queued: await submit("linus", "queued"),
    };
  });
  return { t, ...ids };
}

describe("votes", () => {
  it("caps each participant at two votes", async () => {
    const { t, ada, grace, alan } = await setup();
    const linus = t.withIdentity(identityFor("linus"));
    await linus.mutation(api.votes.cast, { submissionId: ada });
    await linus.mutation(api.votes.cast, { submissionId: grace });
    await expect(linus.mutation(api.votes.cast, { submissionId: alan })).rejects.toThrow(
      /all 2 votes/
    );
    const mine = await linus.query(api.votes.mine);
    expect(mine?.votesLeft).toBe(0);
    expect(mine?.maxVotes).toBe(MAX_VOTES_PER_PARTICIPANT);
    expect(mine?.votedSubmissionIds).toEqual([ada, grace]);
  });

  it("rejects voting for your own entry", async () => {
    const { t, ada } = await setup();
    await expect(
      t.withIdentity(identityFor("ada")).mutation(api.votes.cast, { submissionId: ada })
    ).rejects.toThrow(/own entry/);
  });

  it("only allows voting for done submissions and only lists those", async () => {
    const { t, queued } = await setup();
    await expect(
      t.withIdentity(identityFor("ada")).mutation(api.votes.cast, { submissionId: queued })
    ).rejects.toThrow(/printed entries/);
    const gallery = await t.query(api.votes.gallery);
    expect(gallery.map((g) => g.printCode)).toEqual(["KC-001", "KC-002", "KC-003"]);
    expect(gallery[0].displayName).toBe("Ada T.");
    expect(gallery[0].fileUrl).toBeTruthy();
    expect(JSON.stringify(gallery)).not.toContain("@example.com");
  });

  it("rejects casting and retracting while voting is closed", async () => {
    const { t, ada } = await setup({ votingOpen: false });
    const grace = t.withIdentity(identityFor("grace"));
    await expect(grace.mutation(api.votes.cast, { submissionId: ada })).rejects.toThrow(
      /closed/
    );
    await expect(grace.mutation(api.votes.retract, { submissionId: ada })).rejects.toThrow(
      /closed/
    );
  });

  it("allows one vote per submission", async () => {
    const { t, ada } = await setup();
    const grace = t.withIdentity(identityFor("grace"));
    await grace.mutation(api.votes.cast, { submissionId: ada });
    await expect(grace.mutation(api.votes.cast, { submissionId: ada })).rejects.toThrow(
      /already voted/
    );
    expect((await grace.query(api.votes.mine))?.votesLeft).toBe(1);
  });

  it("retracts a vote so it can be spent elsewhere", async () => {
    const { t, ada, grace, alan } = await setup();
    const linus = t.withIdentity(identityFor("linus"));
    await linus.mutation(api.votes.cast, { submissionId: ada });
    await linus.mutation(api.votes.cast, { submissionId: grace });
    await linus.mutation(api.votes.retract, { submissionId: ada });
    await linus.mutation(api.votes.cast, { submissionId: alan });
    expect((await linus.query(api.votes.mine))?.votedSubmissionIds).toEqual([grace, alan]);
  });

  it("requires a registered participant to vote", async () => {
    const { t, ada } = await setup();
    await expect(t.mutation(api.votes.cast, { submissionId: ada })).rejects.toThrow(
      /Not registered/
    );
    await expect(
      t.withIdentity(identityFor("stranger")).mutation(api.votes.cast, { submissionId: ada })
    ).rejects.toThrow(/Not registered/);
    expect(await t.query(api.votes.mine)).toBeNull();
  });

  it("ranks results for admins and hides them from everyone else", async () => {
    const { t, ada, grace } = await setup();
    await t.withIdentity(identityFor("linus")).mutation(api.votes.cast, { submissionId: grace });
    await t.withIdentity(identityFor("alan")).mutation(api.votes.cast, { submissionId: grace });
    await t.withIdentity(identityFor("alan")).mutation(api.votes.cast, { submissionId: ada });

    await expect(t.query(api.votes.results)).rejects.toThrow();
    await expect(t.withIdentity(identityFor("ada")).query(api.votes.results)).rejects.toThrow(
      /Not an admin/
    );

    const results = await t.withIdentity(identityFor("admin")).query(api.votes.results);
    expect(results.rows.map((r) => [r.rank, r.printCode, r.votes])).toEqual([
      [1, "KC-002", 2],
      [2, "KC-001", 1],
      [3, "KC-003", 0],
    ]);
    expect(results.rows[0].participantEmail).toBe("grace@example.com");
    expect(results.voters).toBe(2);
    expect(results.participants).toBe(4);
  });
});
