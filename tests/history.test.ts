import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const previousOwnerEmail = process.env.OWNER_EMAIL;
const identities = {
  ada: { subject: "ada-user", email: "ada@example.com", emailVerified: true },
  grace: { subject: "grace-user", email: "grace@example.com", emailVerified: true },
  owner: { subject: "owner-user", email: "owner@example.com", emailVerified: true },
  staff: { subject: "staff-user", email: "staff@example.com", emailVerified: true },
};

beforeEach(() => {
  process.env.OWNER_EMAIL = identities.owner.email;
});

afterEach(() => {
  if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = previousOwnerEmail;
});

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("settings", {
      submissionsOpen: true,
      votingOpen: true,
      showResultsOnTv: false,
      maxFileBytes: 1024 * 1024,
      colours: [],
      nextPrintNumber: 1,
    });
    for (const name of ["ada", "grace"] as const) {
      const identity = identities[name];
      await ctx.db.insert("participants", {
        clerkUserId: identity.subject,
        email: identity.email,
        name,
        displayName: name,
      });
    }
    await ctx.db.insert("admins", { email: identities.staff.email, role: "staff" });
  });
  return {
    t,
    ada: t.withIdentity(identities.ada),
    grace: t.withIdentity(identities.grace),
    owner: t.withIdentity(identities.owner),
    staff: t.withIdentity(identities.staff),
  };
}

type TestCtx = Awaited<ReturnType<typeof setup>>["t"];
type TestUser = Awaited<ReturnType<typeof setup>>["ada"];

async function storeFile(t: TestCtx, body: string) {
  return await t.run((ctx) => ctx.storage.store(new Blob([body])));
}

async function createSubmission(user: TestUser, t: TestCtx, role: "vote" | "print" | "both" = "both") {
  const storageId = await storeFile(t, "solid x\nendsolid x\n");
  const result = await user.mutation(api.submissions.create, {
    storageId,
    title: "Rocket",
    originalFileName: "rocket.stl",
    dimensionsMm: { x: 27, y: 51, z: 40 },
    role,
  });
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

describe("submission history", () => {
  it("is owner-only and returns current files, versions, and audit details", async () => {
    const { t, ada, owner, staff, grace } = await setup();
    const id = await createSubmission(ada, t);
    const currentStorage = await storeFile(t, "current model");
    const archivedStorage = await storeFile(t, "archived model");
    const versionId = await t.run(async (ctx) => {
      await ctx.db.patch(id, {
        version: 2,
        storageId: currentStorage,
        originalFileName: "rocket-v2.stl",
      });
      return await ctx.db.insert("submissionVersions", {
        submissionId: id,
        version: 1,
        storageId: archivedStorage,
        originalFileName: "rocket.stl",
        kind: "stl",
        sizeBytes: 20,
        archivedAt: 100,
        why: "replaced",
      });
    });

    await expect(ada.query(api.history.forSubmission, { id })).rejects.toThrow(/Owner only/);
    await expect(staff.query(api.history.forSubmission, { id })).rejects.toThrow(/Owner only/);
    const history = await owner.query(api.history.forSubmission, { id });
    expect(history).toMatchObject({
      printCode: "KC-001",
      title: "Rocket",
      participantUsername: "ada",
      participantEmail: "ada@example.com",
      version: 2,
      current: { version: 2, originalFileName: "rocket-v2.stl" },
      versions: [{ _id: versionId, version: 1, why: "replaced", originalFileName: "rocket.stl" }],
    });
    expect(history?.audit).toEqual(
      expect.arrayContaining([expect.objectContaining({ actor: "ada@example.com", action: "participant.upload" })])
    );
    expect(JSON.stringify(history)).not.toContain("storageId");

    await expect(
      t.query(internal.history.versionDownloadInfo, { versionId: String(versionId) })
    ).rejects.toThrow(/Owner only/);
    const download = await owner.query(internal.history.versionDownloadInfo, { versionId: String(versionId) });
    expect(download).toMatchObject({ storageId: archivedStorage, fileName: "KC-001_ada_any-colour_rocket.stl" });
    await expect(grace.query(api.history.deletedSubmissions, {})).rejects.toThrow(/Owner only/);
  });

  it("restores an older version as a new version and resets review counts", async () => {
    const { t, ada, grace, owner } = await setup();
    const id = await createSubmission(ada, t);
    const old = await t.run((ctx) => ctx.db.get(id));
    const secondStorage = await storeFile(t, "replacement model");
    await ada.mutation(api.submissions.replaceFile, {
      id,
      storageId: secondStorage,
      originalFileName: "rocket-v2.stl",
      dimensionsMm: { x: 27, y: 51, z: 40 },
    });
    const versionOne = await t.run((ctx) =>
      ctx.db.query("submissionVersions").withIndex("by_submission", (q) => q.eq("submissionId", id)).first()
    );
    await t.run(async (ctx) => {
      const participantId = (await ctx.db.query("participants").withIndex("by_email", (q) => q.eq("email", "grace@example.com")).unique())!._id;
      await ctx.db.insert("votes", { voterId: participantId, submissionId: id, version: 2 });
      await ctx.db.insert("likes", { participantId, submissionId: id, reaction: "like", updatedAt: 10, version: 2 });
    });

    await owner.mutation(api.history.restoreVersion, { versionId: versionOne!._id });
    const current = await t.run((ctx) => ctx.db.get(id));
    expect(current).toMatchObject({
      version: 3,
      storageId: old!.storageId,
      originalFileName: "rocket.stl",
      status: "submitted",
      participantNotice: { kind: "restored", version: 3 },
    });
    const versions = await t.run((ctx) =>
      ctx.db.query("submissionVersions").withIndex("by_submission", (q) => q.eq("submissionId", id)).collect()
    );
    expect(versions.map((version) => [version.version, version.why])).toEqual([
      [1, "replaced"],
      [2, "restored"],
    ]);
    const ballot = await grace.query(api.votes.mine);
    expect(ballot).toMatchObject({ votesLeft: 2, droppedVotes: [{ replaced: true }] });
    expect(await grace.query(api.likes.mine)).toEqual([]);
    const versionTwo = versions.find((version) => version.version === 2)!;
    expect(await owner.query(internal.history.versionDownloadInfo, { versionId: String(versionTwo._id) })).toMatchObject({
      fileName: "KC-001_ada_any-colour_rocket_v2.stl",
    });
  });

  it("blocks version restores while a submission is printing or done", async () => {
    const { t, ada, owner } = await setup();
    const id = await createSubmission(ada, t);
    const storageId = await storeFile(t, "replacement model");
    await ada.mutation(api.submissions.replaceFile, {
      id,
      storageId,
      originalFileName: "rocket-v2.stl",
      dimensionsMm: { x: 27, y: 51, z: 40 },
    });
    const version = await t.run((ctx) => ctx.db.query("submissionVersions").first());
    if (!version) throw new Error("expected an archived version");
    for (const status of ["printing", "done"] as const) {
      await t.run((ctx) => ctx.db.patch(id, { status }));
      const blocked = status === "printing" ? "KC-001 is printing. Move it back first." : "KC-001 has been printed. Move it back first.";
      expect((await owner.query(api.history.forSubmission, { id }))?.restoreBlockedReason).toBe(blocked);
      await expect(owner.mutation(api.history.restoreVersion, { versionId: version._id })).rejects.toThrow(blocked);
    }
  });

  it("restores a deleted submission with only the roles still free", async () => {
    const { t, ada, owner } = await setup();
    const deleted = await createSubmission(ada, t, "both");
    await ada.mutation(api.submissions.remove, { id: deleted });
    const other = await createSubmission(ada, t, "vote");

    const deletedRows = await owner.query(api.history.deletedSubmissions, {});
    expect(deletedRows).toMatchObject([
      {
        _id: deleted,
        deletedRoles: { vote: true, print: true },
        restore: { ok: true, vote: false, print: true },
      },
    ]);
    await owner.mutation(api.history.restoreSubmission, { id: deleted });
    const restored = await t.run((ctx) => ctx.db.get(deleted));
    expect(restored).toMatchObject({ designEntry: false, printRequested: true });
    expect(restored?.deletedAt).toBeUndefined();
    expect((await ada.query(api.submissions.mine, {}))?.find((row) => row._id === other)).toMatchObject({ vote: true });
  });

  it("restores all available roles and rejects roleless or over-capacity restores", async () => {
    const { t, ada, owner } = await setup();
    const deleted = await createSubmission(ada, t, "both");
    await ada.mutation(api.submissions.remove, { id: deleted });
    expect(await owner.query(api.history.deletedSubmissions, {})).toMatchObject([
      { _id: deleted, restore: { ok: true, vote: true, print: true } },
    ]);
    await owner.mutation(api.history.restoreSubmission, { id: deleted });
    expect(await t.run((ctx) => ctx.db.get(deleted))).toMatchObject({
      version: 1,
      designEntry: true,
      printRequested: true,
    });
    expect((await t.run((ctx) => ctx.db.get(deleted)))?.deletedAt).toBeUndefined();

    const roleless = await createSubmission(ada, t, "vote");
    await ada.mutation(api.submissions.remove, { id: roleless });
    await t.run((ctx) => ctx.db.patch(roleless, { deletedRoles: { vote: false, print: false } }));
    expect(await owner.query(api.history.deletedSubmissions, {})).toMatchObject([
      { _id: roleless, restore: { ok: false, reason: "KC-002 had no role when it was deleted" } },
    ]);
    await expect(owner.mutation(api.history.restoreSubmission, { id: roleless })).rejects.toThrow(
      "KC-002 had no role when it was deleted"
    );

    const vote = await createSubmission(ada, t, "vote");
    expect(await owner.query(api.history.deletedSubmissions, {})).toMatchObject([
      { _id: roleless, restore: { ok: false, reason: "ada already has 2 active uploads" } },
    ]);
    await expect(owner.mutation(api.history.restoreSubmission, { id: roleless })).rejects.toThrow(
      "ada already has 2 active uploads"
    );
    expect(await t.run((ctx) => ctx.db.get(vote))).toMatchObject({ designEntry: true, printRequested: false });
  });

  it("explains role conflicts when restoring a deleted submission", async () => {
    const { t, ada, owner } = await setup();
    const deleted = await createSubmission(ada, t, "vote");
    await ada.mutation(api.submissions.remove, { id: deleted });
    const current = await createSubmission(ada, t, "vote");
    const rows = await owner.query(api.history.deletedSubmissions, {});
    expect(rows[0].restore).toEqual({ ok: false, reason: "No free role for KC-001: Vote is on KC-002" });
    await expect(owner.mutation(api.history.restoreSubmission, { id: deleted })).rejects.toThrow(
      "No free role for KC-001: Vote is on KC-002"
    );
    expect(await t.run((ctx) => ctx.db.get(current))).toMatchObject({ designEntry: true });
  });
});
