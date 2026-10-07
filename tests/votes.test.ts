import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { MAX_VOTES_PER_PARTICIPANT } from "../lib/event";
import { DEFAULT_SETTINGS } from "../convex/settings";

const modules = import.meta.glob("../convex/**/*.ts");
const previousOwnerEmail = process.env.OWNER_EMAIL;

beforeEach(() => {
  process.env.OWNER_EMAIL = "owner@example.com";
});

afterEach(() => {
  if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = previousOwnerEmail;
});

const identityFor = (who: string) => ({
  subject: `user-${who}`,
  email: `${who}@example.com`,
  emailVerified: true,
});

type Status = "submitted" | "rejected" | "queued" | "printing" | "done";

// ada: printed, grace: queued design, alan: printing, linus: submitted design
// (plus a spare upload), zoe: a legacy rejected row (rejection used to clear
// printRequested, so it isn't a design entry).
async function setup({ votingOpen = true }: { votingOpen?: boolean } = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("admins", { email: "staff@example.com" });
    await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, submissionsOpen: true, votingOpen });
    const storageId = await ctx.storage.store(new Blob(["solid x\nendsolid x\n"]));
    const people: Record<string, Id<"participants">> = {};
    for (const who of ["ada", "grace", "alan", "linus", "zoe"]) {
      people[who] = await ctx.db.insert("participants", {
        clerkUserId: `user-${who}`,
        email: `${who}@example.com`,
        name: who[0].toUpperCase() + who.slice(1) + " Test",
        displayName: `${who}_t`,
      });
    }
    let n = 1;
    const submit = (owner: string, status: Status, printRequested = true) =>
      ctx.db.insert("submissions", {
        participantId: people[owner],
        storageId,
        originalFileName: `${owner}.stl`,
        kind: "stl",
        sizeBytes: 20,
        title: `${owner} ${status}`,
        colour: "Gold",
        printRequested,
        status,
        printCode: `KC-00${n++}`,
      });
    return {
      people,
      ada: await submit("ada", "done"),
      grace: await submit("grace", "queued"),
      alan: await submit("alan", "printing"),
      linus: await submit("linus", "submitted"),
      linusSpare: await submit("linus", "submitted", false),
      rejected: await submit("zoe", "rejected", false),
    };
  });
  return { t, ...ids };
}

const as = (t: Awaited<ReturnType<typeof setup>>["t"], who: string) => t.withIdentity(identityFor(who));

describe("votes", () => {
  it("lists every current entry with a stage chip, usernames only", async () => {
    const { t } = await setup();
    const gallery = await t.query(api.votes.gallery);
    expect(gallery.map((g) => [g.printCode, g.stage, g.displayName])).toEqual([
      ["KC-001", "printed", "ada_t"],
      ["KC-002", "design", "grace_t"],
      ["KC-003", "printing", "alan_t"],
      ["KC-004", "design", "linus_t"],
    ]);
    expect(gallery[0].fileUrl).toBeTruthy();
    expect(JSON.stringify(gallery)).not.toContain("@example.com");
    expect(JSON.stringify(gallery)).not.toContain("Test");
    for (const privateField of ["storageId", "previewStorageId", "submissionVersions", "version", "deletedAt", "deleted"]) {
      expect(JSON.stringify(gallery)).not.toContain(privateField);
    }
  });

  it("returns no standing for signed-out and non-participant viewers", async () => {
    const { t } = await setup();
    expect(await t.query(api.votes.myStanding)).toBeNull();
    expect(await as(t, "stranger").query(api.votes.myStanding)).toBeNull();
  });

  it("ranks zero-vote entries together across all current entries", async () => {
    const { t, grace, ada, alan, linusSpare } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.patch(ada, { printRequested: false });
      await ctx.db.patch(alan, { printRequested: false });
      await ctx.db.patch(linusSpare, { designEntry: true });
    });
    await as(t, "ada").mutation(api.votes.cast, { submissionId: grace });
    await as(t, "alan").mutation(api.votes.cast, { submissionId: grace });

    const standing = await as(t, "linus").query(api.votes.myStanding);
    expect(standing).toMatchObject({
      votingOpen: true,
      votingNotOpenYet: false,
      totalEntries: 3,
      entries: [
        { printCode: "KC-004", rank: 2, votes: 0, likes: 0 },
        { printCode: "KC-005", rank: 2, votes: 0, likes: 0 },
      ],
    });
  });

  it("excludes print-only and removed designs from the viewer's standing", async () => {
    const { t, linus } = await setup();
    expect((await as(t, "linus").query(api.votes.myStanding))?.entries.map((entry) => entry.printCode)).toEqual([
      "KC-004",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.patch(linus, { designRemoved: true });
    });
    const standing = await as(t, "linus").query(api.votes.myStanding);
    expect(standing?.entries).toEqual([]);
    expect(standing?.totalEntries).toBe(3);
  });

  it("allows votes on entries that aren't printed yet", async () => {
    const { t, grace, linus } = await setup();
    await as(t, "ada").mutation(api.votes.cast, { submissionId: grace });
    await as(t, "ada").mutation(api.votes.cast, { submissionId: linus });
    expect((await as(t, "ada").query(api.votes.mine))?.votedSubmissionIds).toEqual([grace, linus]);
  });

  it("rejects votes for submissions that aren't entries", async () => {
    const { t, linusSpare, rejected } = await setup();
    for (const submissionId of [linusSpare, rejected]) {
      await expect(as(t, "ada").mutation(api.votes.cast, { submissionId })).rejects.toThrow(/in the running/);
    }
  });

  it("rejects voting for your own entry", async () => {
    const { t, ada } = await setup();
    await expect(as(t, "ada").mutation(api.votes.cast, { submissionId: ada })).rejects.toThrow(/own entry/);
  });

  it("lets a participant without submissions vote, capped at two", async () => {
    const { t, ada, grace, alan } = await setup();
    const zoe = as(t, "zoe");
    await zoe.mutation(api.votes.cast, { submissionId: ada });
    await zoe.mutation(api.votes.cast, { submissionId: grace });
    await expect(zoe.mutation(api.votes.cast, { submissionId: alan })).rejects.toThrow(/all 2 votes/);
    const mine = await zoe.query(api.votes.mine);
    expect(mine?.votesLeft).toBe(0);
    expect(mine?.maxVotes).toBe(MAX_VOTES_PER_PARTICIPANT);
  });

  it("allows one vote per design", async () => {
    const { t, ada } = await setup();
    await as(t, "zoe").mutation(api.votes.cast, { submissionId: ada });
    await expect(as(t, "zoe").mutation(api.votes.cast, { submissionId: ada })).rejects.toThrow(/already voted/);
    expect((await as(t, "zoe").query(api.votes.mine))?.votesLeft).toBe(1);
  });

  it("allows retracting and swapping votes while voting is open", async () => {
    const { t, ada, grace, alan, linus } = await setup();
    const zoe = as(t, "zoe");
    await zoe.mutation(api.votes.cast, { submissionId: ada });
    await zoe.mutation(api.votes.cast, { submissionId: grace });
    await zoe.mutation(api.votes.retract, { submissionId: ada });
    await zoe.mutation(api.votes.cast, { submissionId: alan });
    await zoe.mutation(api.votes.swap, { from: grace, to: linus });
    expect((await zoe.query(api.votes.mine))?.votedSubmissionIds).toEqual([alan, linus]);
    await expect(zoe.mutation(api.votes.swap, { from: alan, to: linus })).rejects.toThrow(/already voted/);
    await expect(zoe.mutation(api.votes.swap, { from: ada, to: grace })).rejects.toThrow(/haven't voted/);
  });

  it("locks votes and likes once the owner closes voting", async () => {
    const { t, ada, grace, alan } = await setup();
    const zoe = as(t, "zoe");
    await zoe.mutation(api.votes.cast, { submissionId: ada });
    await zoe.mutation(api.likes.react, { submissionId: ada, reaction: "like" });
    await as(t, "owner").mutation(api.settings.update, { votingOpen: false });

    const locked = /Voting has closed — your votes are locked in/;
    await expect(zoe.mutation(api.votes.cast, { submissionId: grace })).rejects.toThrow(locked);
    await expect(zoe.mutation(api.votes.retract, { submissionId: ada })).rejects.toThrow(locked);
    await expect(zoe.mutation(api.votes.swap, { from: ada, to: alan })).rejects.toThrow(locked);
    await expect(zoe.mutation(api.likes.react, { submissionId: grace, reaction: "like" })).rejects.toThrow(locked);
    await expect(zoe.mutation(api.likes.clearReaction, { submissionId: ada })).rejects.toThrow(locked);
    expect((await zoe.query(api.votes.mine))?.votedSubmissionIds).toEqual([ada]);
  });

  it("requires a registered participant to vote", async () => {
    const { t, ada } = await setup();
    await expect(t.mutation(api.votes.cast, { submissionId: ada })).rejects.toThrow(/Not registered/);
    await expect(as(t, "stranger").mutation(api.votes.cast, { submissionId: ada })).rejects.toThrow(/Not registered/);
    expect(await t.query(api.votes.mine)).toBeNull();
  });

  it("drops votes for designs that stop being entries and hands them back", async () => {
    const { t, ada, grace, linus, linusSpare } = await setup();
    const zoe = as(t, "zoe");
    await zoe.mutation(api.votes.cast, { submissionId: grace });
    await zoe.mutation(api.votes.cast, { submissionId: linus });
    await as(t, "ada").mutation(api.votes.cast, { submissionId: grace });

    await t.run(async (ctx) => {
      await ctx.db.patch(grace, { designRemoved: true });
      await ctx.db.patch(linus, { printRequested: false });
      await ctx.db.patch(linusSpare, { printRequested: true });
    });

    const mine = await zoe.query(api.votes.mine);
    expect(mine?.votedSubmissionIds).toEqual([]);
    expect(mine?.votesLeft).toBe(2);
    expect(mine?.droppedVotes.map((d) => d.title)).toEqual(["grace queued", "linus submitted"]);

    const results = await as(t, "owner").query(api.votes.results);
    expect(results.rows.find((r) => r.submissionId === linusSpare)?.votes).toBe(0);
    expect(results.rows.some((r) => r.submissionId === grace)).toBe(false);
    expect(results.voters).toBe(0);

    await zoe.mutation(api.votes.cast, { submissionId: ada });
    await zoe.mutation(api.votes.cast, { submissionId: linusSpare });
    // Linus switching back must not resurrect a third vote.
    await t.run(async (ctx) => {
      await ctx.db.patch(linusSpare, { printRequested: false });
      await ctx.db.patch(linus, { printRequested: true });
    });
    expect((await zoe.query(api.votes.mine))?.votedSubmissionIds).toEqual([ada]);
    await zoe.mutation(api.votes.dismissDropped, {});
    expect((await zoe.query(api.votes.mine))?.droppedVotes).toEqual([]);
  });

  it("resets version-scoped votes and likes when a participant replaces a file", async () => {
    const { t, linus } = await setup();
    const zoe = as(t, "zoe");
    await zoe.mutation(api.votes.cast, { submissionId: linus });
    await zoe.mutation(api.likes.react, { submissionId: linus, reaction: "like" });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["replacement"])));
    expect(
      await as(t, "linus").mutation(api.submissions.replaceFile, {
        id: linus,
        storageId,
        originalFileName: "linus-v2.stl",
        dimensionsMm: { x: 27, y: 51, z: 40 },
      })
    ).toEqual({ ok: true });

    const ballot = await zoe.query(api.votes.mine);
    expect(ballot?.votedSubmissionIds).toEqual([]);
    expect(ballot?.votesLeft).toBe(2);
    expect(ballot?.droppedVotes).toMatchObject([{ replaced: true, printCode: "KC-004" }]);
    expect(await zoe.query(api.likes.mine)).toEqual([]);
    const results = await as(t, "owner").query(api.votes.results);
    expect(results.rows.find((row) => row.submissionId === linus)).toMatchObject({
      votes: 0,
      likes: 0,
    });
    expect((await as(t, "linus").query(api.votes.myStanding))?.entries).toMatchObject([
      { submissionId: linus, votes: 0, likes: 0 },
    ]);

    await zoe.mutation(api.votes.cast, { submissionId: linus });
    expect((await zoe.query(api.votes.mine))?.votedSubmissionIds).toEqual([linus]);
    expect(await t.run((ctx) => ctx.db.query("votes").collect())).toMatchObject([{ version: 2 }]);
  });

  it("keeps votes and likes after a replacement when closed voting retention is enabled", async () => {
    const { t, linus } = await setup();
    const zoe = as(t, "zoe");
    const ada = as(t, "ada");
    const owner = as(t, "owner");
    await zoe.mutation(api.votes.cast, { submissionId: linus });
    await ada.mutation(api.votes.cast, { submissionId: linus });
    await zoe.mutation(api.likes.react, { submissionId: linus, reaction: "like" });
    await t.run(async (ctx) => {
      const settings = (await ctx.db.query("settings").first())!;
      await ctx.db.patch(settings._id, { keepVotesOnReplace: true });
    });
    await owner.mutation(api.settings.update, { votingOpen: false });

    const before = await owner.query(api.votes.results);
    expect(before.rows.find((row) => row.submissionId === linus)).toMatchObject({ votes: 2, likes: 1 });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["replacement"])));
    expect(
      await as(t, "linus").mutation(api.submissions.replaceFile, {
        id: linus,
        storageId,
        originalFileName: "linus-v2.stl",
        dimensionsMm: { x: 27, y: 51, z: 40 },
      })
    ).toEqual({ ok: true });

    const after = await owner.query(api.votes.results);
    expect(after.rows.find((row) => row.submissionId === linus)).toMatchObject({ votes: 2, likes: 1 });
    for (const voter of [zoe, ada]) {
      expect(await voter.query(api.votes.mine)).toMatchObject({
        votesLeft: 1,
        votedSubmissionIds: [linus],
        droppedVotes: [],
      });
    }
    expect(await zoe.query(api.likes.mine)).toEqual([{ submissionId: linus, reaction: "like" }]);
  });

  it("still resets votes and likes after closed voting when retention is unset", async () => {
    const { t, linus } = await setup();
    const zoe = as(t, "zoe");
    const owner = as(t, "owner");
    await zoe.mutation(api.votes.cast, { submissionId: linus });
    await zoe.mutation(api.likes.react, { submissionId: linus, reaction: "like" });
    await owner.mutation(api.settings.update, { votingOpen: false });
    await t.run(async (ctx) => {
      const settings = (await ctx.db.query("settings").first())!;
      await ctx.db.patch(settings._id, { keepVotesOnReplace: undefined });
    });
    expect((await t.query(api.settings.get)).keepVotesOnReplace).toBe(false);

    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["replacement"])));
    await as(t, "linus").mutation(api.submissions.replaceFile, {
      id: linus,
      storageId,
      originalFileName: "linus-v2.stl",
      dimensionsMm: { x: 27, y: 51, z: 40 },
    });

    const ballot = await zoe.query(api.votes.mine);
    expect(ballot?.votedSubmissionIds).toEqual([]);
    expect(ballot?.votesLeft).toBe(2);
    expect(ballot?.droppedVotes).toMatchObject([{ replaced: true, printCode: "KC-004" }]);
    expect(await zoe.query(api.likes.mine)).toEqual([]);
    expect((await owner.query(api.votes.results)).rows.find((row) => row.submissionId === linus)).toMatchObject({
      votes: 0,
      likes: 0,
    });
  });

  it("soft deletion excludes a submission from participant, voting, TV, and admin surfaces", async () => {
    const { t, grace } = await setup();
    const participant = as(t, "grace");
    const voter = as(t, "zoe");
    const owner = as(t, "owner");
    const original = await t.run((ctx) => ctx.db.get(grace));
    await voter.mutation(api.votes.cast, { submissionId: grace });
    await voter.mutation(api.likes.react, { submissionId: grace, reaction: "like" });
    expect(await owner.query(api.queue.counts)).toMatchObject({ queued: 1 });
    await participant.mutation(api.submissions.remove, { id: grace });

    const deleted = await t.run((ctx) => ctx.db.get(grace));
    expect(deleted).toMatchObject({
      status: "submitted",
      deletedAt: expect.any(Number),
      participantNotice: { kind: "withdrawn" },
    });
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "queue.withdrawn", submissionId: grace, detail: "deleted" }),
      ])
    );
    expect((await participant.query(api.submissions.mine, {}))?.some((row) => row._id === grace)).toBe(false);
    expect((await t.query(api.votes.gallery)).some((row) => row._id === grace)).toBe(false);
    expect(JSON.stringify(await t.query(api.tv.board))).not.toContain("KC-002");
    expect(JSON.stringify(await t.query(api.tv.leaderboard, {}))).not.toContain("KC-002");
    expect((await owner.query(api.queue.board)).some((row) => row._id === grace)).toBe(false);
    expect(await owner.query(api.queue.counts)).toMatchObject({ queued: 0 });
    expect((await voter.query(api.votes.mine))?.droppedVotes).toMatchObject([{ printCode: "KC-002", replaced: false }]);
    await expect(owner.mutation(api.queue.approve, { id: grace })).rejects.toThrow(/deleted by the participant/);
    expect(await t.run(async (ctx) => (await ctx.db.system.get("_storage", original!.storageId)) !== null)).toBe(true);
  });

  it("shows results to the owner only", async () => {
    const { t, ada, grace } = await setup();
    await as(t, "linus").mutation(api.votes.cast, { submissionId: grace });
    await as(t, "alan").mutation(api.votes.cast, { submissionId: grace });
    await as(t, "alan").mutation(api.votes.cast, { submissionId: ada });

    await expect(t.query(api.votes.results)).rejects.toThrow(/Owner only/);
    await expect(as(t, "ada").query(api.votes.results)).rejects.toThrow(/Owner only/);
    await expect(as(t, "staff").query(api.votes.results)).rejects.toThrow(/Owner only/);
    await expect(as(t, "staff").mutation(api.settings.update, { votingOpen: false })).rejects.toThrow(/Owner only/);

    const results = await as(t, "owner").query(api.votes.results);
    expect(results.rows.map((r) => [r.rank, r.printCode, r.votes, r.stage])).toEqual([
      [1, "KC-002", 2, "design"],
      [2, "KC-001", 1, "printed"],
      [3, "KC-003", 0, "printing"],
      [4, "KC-004", 0, "design"],
    ]);
    expect(results.winner?.printCode).toBe("KC-002");
    expect(results.rows[0]).toMatchObject({ displayName: "grace_t", participantName: "Grace Test", participantEmail: "grace@example.com" });
    expect(results.voters).toBe(2);
    expect(results.participants).toBe(5);
  });

  it("ranks by votes, then likes, then print code with a single winner", async () => {
    const { t, ada, alan } = await setup();
    // ada and alan tie on votes; alan has more likes. grace and linus tie on everything.
    await as(t, "zoe").mutation(api.votes.cast, { submissionId: ada });
    await as(t, "grace").mutation(api.votes.cast, { submissionId: alan });
    for (const who of ["linus", "grace", "zoe"]) {
      await as(t, who).mutation(api.likes.react, { submissionId: alan, reaction: "like" });
    }
    await as(t, "linus").mutation(api.likes.react, { submissionId: ada, reaction: "like" });
    await as(t, "alan").mutation(api.likes.react, { submissionId: ada, reaction: "skip" });

    const results = await as(t, "owner").query(api.votes.results);
    expect(results.rows.map((r) => [r.rank, r.printCode, r.votes, r.likes, r.skips, r.tiedWithPrevious])).toEqual([
      [1, "KC-003", 1, 3, 0, false],
      [2, "KC-001", 1, 1, 1, false],
      [3, "KC-002", 0, 0, 0, false],
      [4, "KC-004", 0, 0, 0, true],
    ]);
    expect(results.winner?.printCode).toBe("KC-003");
  });

  it("has no winner before any votes", async () => {
    const { t } = await setup();
    expect((await as(t, "owner").query(api.votes.results)).winner).toBeNull();
  });
});

describe("design entries", () => {
  const galleryCodes = async (t: Awaited<ReturnType<typeof setup>>["t"]) =>
    (await t.query(api.votes.gallery)).map((g) => g.printCode);

  it("counts legacy rows (no designEntry field) and their votes", async () => {
    const { t, grace } = await setup();
    expect(await t.run(async (ctx) => "designEntry" in (await ctx.db.get(grace))!)).toBe(false);
    await as(t, "zoe").mutation(api.votes.cast, { submissionId: grace });
    const results = await as(t, "owner").query(api.votes.results);
    expect(results.rows.find((r) => r.submissionId === grace)?.votes).toBe(1);
    expect(results.winner?.printCode).toBe("KC-002");
  });

  it("lists a design entry that has no print request", async () => {
    const { t, linus, linusSpare } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.patch(linus, { designEntry: false });
      await ctx.db.patch(linusSpare, { designEntry: true });
    });
    await as(t, "zoe").mutation(api.votes.cast, { submissionId: linusSpare });
    expect(await galleryCodes(t)).toEqual(["KC-001", "KC-002", "KC-003", "KC-005"]);
    const results = await as(t, "owner").query(api.votes.results);
    expect(results.rows.find((r) => r.submissionId === linusSpare)).toMatchObject({ votes: 1, rank: 1 });
    expect(results.rows.some((r) => r.submissionId === linus)).toBe(false);
    await expect(as(t, "zoe").mutation(api.votes.cast, { submissionId: linus })).rejects.toThrow(/in the running/);
  });

  it("keeps a design in voting when staff reject its print", async () => {
    const { t, grace } = await setup();
    await as(t, "zoe").mutation(api.votes.cast, { submissionId: grace });
    await as(t, "staff").mutation(api.queue.reject, { id: grace, reason: "Walls too thin" });
    expect(await t.run(async (ctx) => await ctx.db.get(grace))).toMatchObject({
      status: "rejected",
      printRequested: false,
      designEntry: true,
    });
    expect(await galleryCodes(t)).toContain("KC-002");
    expect((await as(t, "zoe").query(api.votes.mine))?.votedSubmissionIds).toEqual([grace]);
    expect((await as(t, "owner").query(api.votes.results)).rows.find((r) => r.submissionId === grace)?.votes).toBe(1);
  });

  it("removeFromCompetition hides a design and its votes; restore brings both back", async () => {
    const { t, grace } = await setup();
    await as(t, "zoe").mutation(api.votes.cast, { submissionId: grace });
    await expect(as(t, "ada").mutation(api.queue.removeFromCompetition, { id: grace })).rejects.toThrow();

    await as(t, "staff").mutation(api.queue.removeFromCompetition, { id: grace, reason: " Offensive " });
    expect(await galleryCodes(t)).not.toContain("KC-002");
    let results = await as(t, "owner").query(api.votes.results);
    expect(results.rows.some((r) => r.submissionId === grace)).toBe(false);
    expect(results.voters).toBe(0);
    await expect(as(t, "ada").mutation(api.votes.cast, { submissionId: grace })).rejects.toThrow(/in the running/);
    expect(await t.run(async (ctx) => await ctx.db.get(grace))).toMatchObject({
      status: "queued",
      printRequested: true,
      designRemoved: true,
      designRemovedReason: "Offensive",
    });

    await as(t, "staff").mutation(api.queue.restoreToCompetition, { id: grace });
    expect(await galleryCodes(t)).toContain("KC-002");
    results = await as(t, "owner").query(api.votes.results);
    expect(results.rows.find((r) => r.submissionId === grace)?.votes).toBe(1);

    const actions = await t.run(async (ctx) => (await ctx.db.query("auditLog").collect()).map((r) => r.action));
    expect(actions).toEqual(expect.arrayContaining(["competition.remove", "competition.restore"]));
  });

  it("removeFromCompetition only applies to design entries", async () => {
    const { t, linusSpare } = await setup();
    await expect(as(t, "staff").mutation(api.queue.removeFromCompetition, { id: linusSpare })).rejects.toThrow(
      /isn't a competition entry/
    );
  });
});
