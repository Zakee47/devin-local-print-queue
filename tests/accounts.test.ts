/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

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

const OWNER = "owner@example.com";

function setup() {
  process.env.OWNER_EMAIL = OWNER;
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(identity("owner", OWNER));
  return { t, owner };
}

async function seedParticipant(
  t: TestConvex<typeof schema>,
  name: string,
  email = `${name}@example.com`
) {
  return await t.run((ctx) =>
    ctx.db.insert("participants", {
      clerkUserId: name,
      email,
      name,
      displayName: name,
      usernameKey: name.toLowerCase(),
    })
  );
}

describe("owner-only gating", () => {
  test("staff and registered participants are rejected from every accounts function", async () => {
    const { t } = setup();
    await t.run((ctx) =>
      ctx.db.insert("admins", { email: "staff@example.com", role: "staff" })
    );
    const blockedId = await t.run((ctx) =>
      ctx.db.insert("blockedEmails", {
        email: "x@example.com",
        blockedBy: OWNER,
      })
    );
    const participantId = await seedParticipant(t, "ada");
    const staff = t.withIdentity(identity("staff", "staff@example.com"));
    const ada = t.withIdentity(identity("ada", "ada@example.com"));

    for (const viewer of [staff, ada]) {
      await expect(viewer.query(api.accounts.team, {})).rejects.toThrow("Owner only");
      await expect(viewer.query(api.accounts.listParticipants, {})).rejects.toThrow(
        "Owner only"
      );
      await expect(
        viewer.mutation(api.accounts.renameParticipant, {
          participantId,
          username: "New Name",
        })
      ).rejects.toThrow("Owner only");
      await expect(
        viewer.mutation(api.accounts.deleteParticipant, { participantId, block: false })
      ).rejects.toThrow("Owner only");
      await expect(viewer.query(api.accounts.listBlocked, {})).rejects.toThrow("Owner only");
      await expect(
        viewer.mutation(api.accounts.unblock, { id: blockedId })
      ).rejects.toThrow("Owner only");
    }
  });
});

describe("deleteParticipant cascade", () => {
  test("removes submissions, files, votes and likes involving the participant", async () => {
    const { t, owner } = setup();
    const seeded = await t.run(async (ctx) => {
      const a = await ctx.db.insert("participants", {
        clerkUserId: "a",
        email: "a@example.com",
        name: "A",
        displayName: "A Name",
        usernameKey: "a name",
      });
      const b = await ctx.db.insert("participants", {
        clerkUserId: "b",
        email: "b@example.com",
        name: "B",
        displayName: "B Name",
        usernameKey: "b name",
      });
      const storageIds: Id<"_storage">[] = [];
      const aSubs: Id<"submissions">[] = [];
      // A's first submission shares a blob with B's submission below; the
      // second uses its own blob.
      const sharedStorage = await ctx.storage.store(new Blob(["solid shared"]));
      const aOnlyStorage = await ctx.storage.store(new Blob(["solid a"]));
      const aVersionStorage = await ctx.storage.store(new Blob(["solid old a"]));
      const aVersionPreview = await ctx.storage.store(new Blob(["preview old a"]));
      const sharedVersionStorage = await ctx.storage.store(new Blob(["solid shared version"]));
      const sharedVersionPreview = await ctx.storage.store(new Blob(["preview shared version"]));
      for (let i = 0; i < 2; i++) {
        const storageId = i === 0 ? sharedStorage : aOnlyStorage;
        storageIds.push(storageId);
        aSubs.push(
          await ctx.db.insert("submissions", {
            participantId: a,
            storageId,
            originalFileName: `a${i}.stl`,
            kind: "stl",
            sizeBytes: 8,
            title: `A${i}`,
            printRequested: i === 0,
            status: "submitted",
            printCode: `KC-00${i}`,
          })
        );
      }
      const bStorage = sharedStorage;
      const bSub = await ctx.db.insert("submissions", {
        participantId: b,
        storageId: bStorage,
        originalFileName: "b.stl",
        kind: "stl",
        sizeBytes: 8,
        title: "B entry",
        printRequested: true,
        status: "submitted",
        printCode: "KC-010",
      });
      await ctx.db.insert("submissionVersions", {
        submissionId: aSubs[0],
        version: 1,
        storageId: aVersionStorage,
        previewStorageId: aVersionPreview,
        originalFileName: "a-old.stl",
        kind: "stl",
        sizeBytes: 8,
        archivedAt: 1,
        why: "replaced",
      });
      await ctx.db.insert("submissionVersions", {
        submissionId: aSubs[0],
        version: 2,
        storageId: sharedVersionStorage,
        previewStorageId: sharedVersionPreview,
        originalFileName: "a-shared.stl",
        kind: "stl",
        sizeBytes: 8,
        archivedAt: 2,
        why: "replaced",
      });
      await ctx.db.insert("submissionVersions", {
        submissionId: bSub,
        version: 1,
        storageId: sharedVersionStorage,
        previewStorageId: sharedVersionPreview,
        originalFileName: "b-shared.stl",
        kind: "stl",
        sizeBytes: 8,
        archivedAt: 2,
        why: "replaced",
      });
      // A votes and likes B's entry; B votes and likes A's entry; A likes own entry.
      await ctx.db.insert("votes", { voterId: a, submissionId: bSub });
      await ctx.db.insert("likes", {
        participantId: a,
        submissionId: bSub,
        reaction: "like",
        updatedAt: 1,
      });
      await ctx.db.insert("votes", { voterId: b, submissionId: aSubs[0] });
      await ctx.db.insert("likes", {
        participantId: b,
        submissionId: aSubs[0],
        reaction: "like",
        updatedAt: 1,
      });
      await ctx.db.insert("likes", {
        participantId: a,
        submissionId: aSubs[0],
        reaction: "like",
        updatedAt: 1,
      });
      return {
        a,
        b,
        aSubs,
        bSub,
        storageIds,
        bStorage,
        aVersionStorage,
        aVersionPreview,
        sharedVersionStorage,
        sharedVersionPreview,
      };
    });
    const {
      a,
      b,
      aSubs,
      bSub,
      storageIds,
      bStorage,
      aVersionStorage,
      aVersionPreview,
      sharedVersionStorage,
      sharedVersionPreview,
    } = seeded;

    const res = await owner.mutation(api.accounts.deleteParticipant, {
      participantId: a,
      block: false,
    });
    expect(res).toEqual({ submissions: 2, votes: 2, likes: 3 });

    await t.run(async (ctx) => {
      expect(await ctx.db.get(a)).toBeNull();
      for (const id of aSubs) expect(await ctx.db.get(id)).toBeNull();
      expect(await ctx.db.get(b)).not.toBeNull();
      expect(await ctx.db.get(bSub)).not.toBeNull();
      expect(await ctx.db.query("votes").collect()).toEqual([]);
      expect(await ctx.db.query("likes").collect()).toEqual([]);
      // A's own blob is gone; the blob shared with B's submission survives.
      expect(await ctx.storage.get(storageIds[1])).toBeNull();
      expect(await ctx.storage.get(storageIds[0])).not.toBeNull();
      expect(await ctx.storage.get(bStorage)).not.toBeNull();
      expect(await ctx.storage.get(aVersionStorage)).toBeNull();
      expect(await ctx.storage.get(aVersionPreview)).toBeNull();
      expect(await ctx.storage.get(sharedVersionStorage)).not.toBeNull();
      expect(await ctx.storage.get(sharedVersionPreview)).not.toBeNull();
      expect(await ctx.db.query("submissionVersions").collect()).toMatchObject([
        { submissionId: bSub, storageId: sharedVersionStorage, previewStorageId: sharedVersionPreview },
      ]);
    });

    const logs = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actor: OWNER,
      action: "participant.delete",
    });
    expect(logs[0].detail).toContain("A Name");
    expect(logs[0].detail).toContain("a@example.com");
    expect(logs[0].detail).not.toContain("blocked");
  });
});

describe("blocking", () => {
  async function registerableParticipant(t: TestConvex<typeof schema>) {
    const importId = await t.run((ctx) =>
      ctx.db.insert("guestImports", {
        fileName: "test.csv",
        uploadedBy: "test",
        rowCount: 1,
        eligibleCount: 1,
        hasCheckInColumn: true,
      })
    );
    await t.run((ctx) =>
      ctx.db.insert("guests", { email: "ada@example.com", checkedIn: true, importId })
    );
    const ada = t.withIdentity(identity("ada", "ada@example.com"));
    await ada.mutation(api.participants.register, { username: "Ada" });
    const participantId = (await t.run((ctx) =>
      ctx.db
        .query("participants")
        .withIndex("by_email", (q) => q.eq("email", "ada@example.com"))
        .unique()
    ))!._id;
    return { ada, participantId };
  }

  test("block prevents re-registration until unblocked", async () => {
    const { t, owner } = setup();
    const { ada, participantId } = await registerableParticipant(t);

    await owner.mutation(api.accounts.deleteParticipant, {
      participantId,
      block: true,
      reason: "  Disqualified  ",
    });
    const blocked = await owner.query(api.accounts.listBlocked, {});
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({
      email: "ada@example.com",
      reason: "Disqualified",
      blockedBy: OWNER,
    });

    await expect(
      ada.mutation(api.participants.register, { username: "Ada Again" })
    ).rejects.toThrow("This account has been removed by the organisers");
    expect(await ada.query(api.participants.viewerStatus, {})).toEqual({
      state: "blocked",
      email: "ada@example.com",
    });

    await owner.mutation(api.accounts.unblock, { id: blocked[0]._id });
    await ada.mutation(api.participants.register, { username: "Ada Again" });
    expect(await ada.query(api.participants.viewerStatus, {})).toMatchObject({
      state: "registered",
    });
    const logs = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(logs.map((l) => l.action)).toEqual(["participant.delete", "blocked.remove"]);
    expect(logs[0].detail).toContain("(blocked)");
  });

  test("delete without block allows immediate re-registration", async () => {
    const { t, owner } = setup();
    const { ada, participantId } = await registerableParticipant(t);
    await owner.mutation(api.accounts.deleteParticipant, {
      participantId,
      block: false,
    });
    await ada.mutation(api.participants.register, { username: "Ada Back" });
    expect(await ada.query(api.participants.viewerStatus, {})).toMatchObject({
      state: "registered",
    });
  });
});

describe("renameParticipant", () => {
  test("validates, enforces uniqueness case-insensitively and updates the key", async () => {
    const { t, owner } = setup();
    const a = await seedParticipant(t, "Ada", "ada@example.com");
    await seedParticipant(t, "Grace", "grace@example.com");

    const missing = await t.run(async (ctx) => {
      const id = await ctx.db.insert("participants", {
        clerkUserId: "gone",
        email: "gone@example.com",
        name: "Gone",
        displayName: "gone",
      });
      await ctx.db.delete(id);
      return id;
    });
    await expect(
      owner.mutation(api.accounts.renameParticipant, {
        participantId: missing,
        username: "Whatever",
      })
    ).rejects.toThrow("Participant not found");

    await expect(
      owner.mutation(api.accounts.renameParticipant, { participantId: a, username: "x" })
    ).rejects.toThrow(/between 2 and 24/);

    await expect(
      owner.mutation(api.accounts.renameParticipant, {
        participantId: a,
        username: "GRACE",
      })
    ).rejects.toThrow("That username is taken");

    // Renaming to own name in different case is fine.
    await owner.mutation(api.accounts.renameParticipant, {
      participantId: a,
      username: "ADA",
    });
    expect(await t.run((ctx) => ctx.db.get(a))).toMatchObject({
      displayName: "ADA",
      usernameKey: "ada",
    });

    await owner.mutation(api.accounts.renameParticipant, {
      participantId: a,
      username: "  Ada  L. ",
    });
    expect(await t.run((ctx) => ctx.db.get(a))).toMatchObject({
      displayName: "Ada L.",
      usernameKey: "ada l.",
    });
    const logs = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(logs.map((l) => l.action)).toEqual(["participant.rename", "participant.rename"]);
    expect(logs[1].detail).toBe("ada@example.com: ADA -> Ada L.");
  });
});

describe("listParticipants", () => {
  test("returns fields and counts sorted newest first", async () => {
    const { t, owner } = setup();
    const ids = await t.run(async (ctx) => {
      const a = await ctx.db.insert("participants", {
        clerkUserId: "a",
        email: "a@example.com",
        name: "Ada Lovelace",
        displayName: "ada",
        usernameKey: "ada",
      });
      const b = await ctx.db.insert("participants", {
        clerkUserId: "b",
        email: "b@example.com",
        name: "Grace Hopper",
        displayName: "grace",
        usernameKey: "grace",
      });
      const storageId = await ctx.storage.store(new Blob(["x"]));
      const aEntry = await ctx.db.insert("submissions", {
        participantId: a,
        storageId,
        originalFileName: "a.stl",
        kind: "stl",
        sizeBytes: 1,
        title: "Rocket",
        printRequested: true,
        status: "done",
        printCode: "KC-001",
      });
      await ctx.db.insert("submissions", {
        participantId: a,
        storageId,
        originalFileName: "a2.stl",
        kind: "stl",
        sizeBytes: 1,
        title: "Rejected one",
        printRequested: false,
        status: "rejected",
        printCode: "KC-002",
      });
      const bEntry = await ctx.db.insert("submissions", {
        participantId: b,
        storageId,
        originalFileName: "b.stl",
        kind: "stl",
        sizeBytes: 1,
        title: "Ring",
        printRequested: true,
        status: "queued",
        printCode: "KC-003",
      });
      await ctx.db.patch(aEntry, { version: 2 });
      await ctx.db.insert("votes", { voterId: a, submissionId: bEntry });
      await ctx.db.insert("votes", { voterId: b, submissionId: aEntry });
      await ctx.db.insert("votes", { voterId: a, submissionId: aEntry });
      await ctx.db.insert("votes", { voterId: b, submissionId: aEntry, version: 2 });
      await ctx.db.insert("likes", {
        participantId: b,
        submissionId: aEntry,
        reaction: "like",
        updatedAt: 1,
      });
      await ctx.db.insert("likes", {
        participantId: b,
        submissionId: aEntry,
        reaction: "skip",
        updatedAt: 1,
      });
      await ctx.db.insert("likes", {
        participantId: b,
        submissionId: aEntry,
        reaction: "like",
        updatedAt: 2,
        version: 2,
      });
      return { a, b };
    });
    const list = await owner.query(api.accounts.listParticipants, {});
    // b was inserted after a, so b is first.
    expect(list.map((p) => p.username)).toEqual(["grace", "ada"]);
    const ada = list[1];
    expect(ada).toMatchObject({
      _id: ids.a,
      name: "Ada Lovelace",
      email: "a@example.com",
      uploadCount: 2,
      votesCast: 2,
      votesReceived: 1,
      likesReceived: 1,
    });
    expect(ada.entry).toEqual({ printCode: "KC-001", title: "Rocket", status: "done" });
    const grace = list[0];
    expect(grace.entry).toEqual({ printCode: "KC-003", title: "Ring", status: "queued" });
    expect(grace.votesCast).toBe(2);
    expect(grace.votesReceived).toBe(1);
  });
});

describe("team", () => {
  test("returns owner email and staff sorted by email", async () => {
    const { t, owner } = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("admins", { email: "zeta@example.com" });
      await ctx.db.insert("admins", { email: "beta@example.com" });
    });
    const team = await owner.query(api.accounts.team, {});
    expect(team.ownerEmail).toBe(OWNER);
    expect(team.staff.map((s) => s.email)).toEqual([
      "beta@example.com",
      "zeta@example.com",
    ]);
  });
});
