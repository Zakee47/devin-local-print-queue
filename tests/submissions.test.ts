import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";
import { entryFor } from "../convex/entries";
import type { Role } from "../lib/roles";

const modules = import.meta.glob("../convex/**/*.ts");
const KEYCHAIN = { x: 27, y: 51, z: 40 };

afterEach(() => {
  vi.useRealTimers();
});

const ada = { subject: "user_ada", email: "ada@example.com", emailVerified: true };
const grace = { subject: "user_grace", email: "grace@example.com", emailVerified: true };

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const importId = await ctx.db.insert("guestImports", {
      fileName: "test.csv",
      uploadedBy: "test",
      rowCount: 2,
      eligibleCount: 2,
      hasCheckInColumn: true,
    });
    for (const g of [ada, grace]) {
      await ctx.db.insert("guests", { email: g.email, checkedIn: true, importId });
    }
    await ctx.db.insert("settings", {
      submissionsOpen: true,
      votingOpen: true,
      showResultsOnTv: false,
      maxFileBytes: 1024 * 1024,
      colours: ["Black"],
      nextPrintNumber: 1,
    });
  });
  const asAda = t.withIdentity(ada);
  const asGrace = t.withIdentity(grace);
  await asAda.mutation(api.participants.register, { username: "Ada Lovelace" });
  await asGrace.mutation(api.participants.register, { username: "Grace Hopper" });
  return { t, asAda, asGrace };
}

type T = Awaited<ReturnType<typeof setup>>["t"];
type User = Awaited<ReturnType<typeof setup>>["asAda"];

async function storeBlob(t: T, bytes = 128) {
  return await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)])));
}

async function upload(
  t: T,
  user: User,
  opts: {
    name?: string;
    title?: string;
    colour?: string;
    bytes?: number;
    dimensionsMm?: { x: number; y: number; z: number };
    role?: Role;
  } = {}
) {
  const active = (await user.query(api.submissions.mine, {}))?.filter((submission) => submission.active) ?? [];
  const role =
    opts.role ??
    (!active.some((submission) => submission.print)
      ? "print"
      : !active.some((submission) => submission.vote)
        ? "vote"
        : "print");
  const storageId = await storeBlob(t, opts.bytes);
  const result = await user.mutation(api.submissions.create, {
    storageId,
    title: opts.title ?? "Rocket",
    colour: opts.colour,
    originalFileName: opts.name ?? "rocket.stl",
    dimensionsMm: opts.dimensionsMm ?? KEYCHAIN,
    role,
  });
  return { storageId, result };
}

async function uploadOk(t: T, user: User, opts: Parameters<typeof upload>[2] = {}) {
  const { result } = await upload(t, user, opts);
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

async function setStatus(
  t: T,
  id: Id<"submissions">,
  patch: Partial<{
    status: "submitted" | "queued" | "rejected" | "printing" | "done";
    queueOrder: number;
    rejectionReason: string;
    rejectionKind: "review" | "print_failed";
    rejectedAt: number;
    printRequested: boolean;
  }>
) {
  await t.run((ctx) => ctx.db.patch(id, patch));
}

async function storageExists(t: T, storageId: Id<"_storage">) {
  return await t.run(async (ctx) => (await ctx.db.system.get(storageId)) !== null);
}

describe("create", () => {
  test("allocates print codes and makes Vote visible immediately", async () => {
    const { t, asAda } = await setup();
    await uploadOk(t, asAda, { title: "  One  ", colour: "black", role: "vote" });
    await uploadOk(t, asAda, { title: "Two", name: "two.3MF", role: "print" });
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.map((s) => [s.printCode, s.title, s.kind, s.colour, s.vote, s.print])).toEqual([
      ["KC-001", "One", "stl", "Black", true, false],
      ["KC-002", "Two", "3mf", undefined, false, true],
    ]);
    expect((await t.query(api.votes.gallery)).map((entry) => entry._id)).toEqual([mine[0]._id]);
    expect(mine[0].fileUrl).toBeTruthy();
    expect(mine.every((s) => s.status === "submitted")).toBe(true);
  });

  test("creates a Both role", async () => {
    const { t, asAda } = await setup();
    const id = await uploadOk(t, asAda, { role: "both" });
    expect((await asAda.query(api.submissions.mine, {}))![0]).toMatchObject({
      _id: id,
      status: "submitted",
      vote: true,
      print: true,
    });
    expect((await t.query(api.votes.gallery)).map((entry) => entry._id)).toEqual([id]);
  });

  test("limits a participant to 2 active entries", async () => {
    const { t, asAda } = await setup();
    await uploadOk(t, asAda);
    await uploadOk(t, asAda);
    const { storageId, result } = await upload(t, asAda);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/at most 2/) });
    expect(await storageExists(t, storageId)).toBe(false);
    await expect(asAda.mutation(api.submissions.generateUploadUrl, {})).rejects.toThrow(/at most 2/);
  });

  test("requires a role", async () => {
    const { t, asAda } = await setup();
    const storageId = await storeBlob(t);
    await expect(
      asAda.mutation(api.submissions.create, {
        storageId,
        title: "A",
        originalFileName: "a.stl",
        dimensionsMm: KEYCHAIN,
      } as unknown as Parameters<typeof asAda.mutation<typeof api.submissions.create>>[1])
    ).rejects.toThrow(/role/);
  });

  test("moves roles on creation and leaves no writes when a move would remove both roles", async () => {
    const { t, asAda } = await setup();
    const first = await uploadOk(t, asAda, { role: "both" });
    const second = await uploadOk(t, asAda, { role: "print" });
    let mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.find((submission) => submission._id === first)).toMatchObject({ vote: true, print: false });
    expect(mine.find((submission) => submission._id === second)).toMatchObject({ vote: false, print: true });
    await asAda.mutation(api.submissions.remove, { id: second });

    const storageId = await storeBlob(t);
    const result = await asAda.mutation(api.submissions.create, {
      storageId,
      title: "Another",
      originalFileName: "another.stl",
      dimensionsMm: KEYCHAIN,
      role: "both",
    });
    expect(result).toEqual({ ok: false, error: "KC-001 must keep Vote or Print" });
    expect(await storageExists(t, storageId)).toBe(false);
    mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((submission) => submission.active)).toHaveLength(1);
    expect(mine.find((submission) => submission._id === first)).toMatchObject({ vote: true, print: true });
    expect(await t.run((ctx) => ctx.db.query("submissions").collect())).toHaveLength(2);
  });

  test("creating a Print upload withdraws a queued Print from another file", async () => {
    const { t, asAda } = await setup();
    const first = await uploadOk(t, asAda, { role: "both" });
    await setStatus(t, first, { status: "queued", queueOrder: 4 });
    const second = await uploadOk(t, asAda, { role: "print" });
    const withdrawn = await t.run((ctx) => ctx.db.get(first));
    expect(withdrawn).toMatchObject({
      status: "submitted",
      designEntry: true,
      printRequested: false,
      participantNotice: { kind: "withdrawn" },
    });
    expect(withdrawn?.queueOrder).toBeUndefined();
    expect(withdrawn?.queuedAt).toBeUndefined();
    expect(withdrawn?.printer).toBeUndefined();
    expect(withdrawn?.printingAt).toBeUndefined();
    expect(withdrawn?.reviewedBy).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.get(second))).toMatchObject({ designEntry: false, printRequested: true });
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "queue.withdrawn", submissionId: first, detail: "print removed" }),
        expect.objectContaining({ action: "participant.roles", submissionId: first }),
      ])
    );
  });

  test("a rejected entry frees a slot and the new entry takes the print request", async () => {
    const { t, asAda } = await setup();
    const first = await uploadOk(t, asAda, { role: "print" });
    await uploadOk(t, asAda, { role: "vote" });
    await setStatus(t, first, { status: "rejected", rejectionReason: "Too big" });
    await t.run((ctx) => ctx.db.patch(first, { printRequested: false }));
    const third = await uploadOk(t, asAda);
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.active)).toHaveLength(2);
    expect(mine.find((s) => s._id === first)!.rejectionReason).toBe("Too big");
    // The second entry wasn't requested, so the new one becomes the print choice.
    expect(mine.filter((s) => s.printRequested).map((s) => s._id)).toEqual([third]);
  });

  test("rejects other file types and deletes the upload", async () => {
    const { t, asAda } = await setup();
    const { storageId, result } = await upload(t, asAda, { name: "rocket.obj" });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/STL or 3MF/) });
    expect(await storageExists(t, storageId)).toBe(false);
  });

  test("legacy roleless backups still occupy an upload slot", async () => {
    const { t, asAda } = await setup();
    const legacy = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["legacy backup"]));
      const participantId = (await ctx.db.query("participants").collect()).find(
        (participant) => participant.email === "ada@example.com"
      )!._id;
      return await ctx.db.insert("submissions", {
        participantId,
        storageId,
        originalFileName: "backup.stl",
        kind: "stl",
        sizeBytes: 13,
        title: "Backup",
        printRequested: false,
        status: "submitted",
        printCode: "KC-001",
      });
    });
    await uploadOk(t, asAda, { role: "both" });
    const { storageId, result } = await upload(t, asAda, { role: "vote" });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/at most 2/) });
    expect(await storageExists(t, storageId)).toBe(false);
    expect(await t.run((ctx) => ctx.db.get(legacy))).toMatchObject({ printRequested: false });
  });

  test("rejects files over settings.maxFileBytes and deletes the upload", async () => {
    const { t, asAda } = await setup();
    await insertSettings(t, { maxFileBytes: 1024 * 1024, colours: ["Red"] });
    const { storageId, result } = await upload(t, asAda, { bytes: 1024 * 1024 + 1 });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/1 MB or smaller/) });
    expect(await storageExists(t, storageId)).toBe(false);
    await uploadOk(t, asAda, { bytes: 1024 * 1024 });
  });

  test("validates title and colour", async () => {
    const { t, asAda } = await setup();
    expect((await upload(t, asAda, { title: "  " })).result.ok).toBe(false);
    expect((await upload(t, asAda, { title: "x".repeat(61) })).result.ok).toBe(false);
    expect((await upload(t, asAda, { colour: "Chartreuse" })).result.ok).toBe(false);
    expect(await asAda.query(api.submissions.mine, {})).toEqual([]);
  });

  test("refuses uploads when submissions are closed", async () => {
    const { t, asAda } = await setup();
    await insertSettings(t, { submissionsOpen: false, colours: [] });
    await expect(asAda.mutation(api.submissions.generateUploadUrl, {})).rejects.toThrow(/closed/);
    const { storageId, result } = await upload(t, asAda);
    expect(result).toEqual({ ok: false, error: "Submissions are closed" });
    expect(await storageExists(t, storageId)).toBe(false);
  });

  test("allows a fixed replacement after a print failure when submissions are closed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T18:00:00Z"));
    const { t, asAda } = await setup();
    await insertSettings(t);
    const failed = await uploadOk(t, asAda);
    const rejectedAt = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.patch(failed, {
        status: "rejected",
        rejectionKind: "print_failed",
        rejectedAt,
        printRequested: false,
      });
      const settings = await ctx.db.query("settings").first();
      await ctx.db.patch(settings!._id, { submissionsOpen: false });
    });
    vi.setSystemTime(rejectedAt + 1);

    expect((await asAda.query(api.submissions.mine, {}))![0].canUploadReplacement).toBe(true);
    const voteOnly = await upload(t, asAda, { role: "vote" });
    expect(voteOnly.result).toEqual({
      ok: false,
      error: "Submissions are closed, so you can only upload a replacement print",
    });
    expect(await storageExists(t, voteOnly.storageId)).toBe(false);
    expect(await asAda.mutation(api.submissions.generateUploadUrl, {})).toBeTruthy();
    await expect(uploadOk(t, asAda)).resolves.toBeTruthy();
  });

  test("blocks uploads after a review rejection when submissions are closed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T18:00:00Z"));
    const { t, asAda } = await setup();
    await insertSettings(t);
    const rejected = await uploadOk(t, asAda);
    const rejectedAt = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.patch(rejected, {
        status: "rejected",
        rejectionKind: "review",
        rejectedAt,
        printRequested: false,
      });
      const settings = await ctx.db.query("settings").first();
      await ctx.db.patch(settings!._id, { submissionsOpen: false });
    });
    vi.setSystemTime(rejectedAt + 1);

    await expect(asAda.mutation(api.submissions.generateUploadUrl, {})).rejects.toThrow(/closed/);
    const { storageId, result } = await upload(t, asAda);
    expect(result).toEqual({ ok: false, error: "Submissions are closed" });
    expect(await storageExists(t, storageId)).toBe(false);
  });

  test("blocks another closed-window upload after a replacement already exists", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T18:00:00Z"));
    const { t, asAda } = await setup();
    await insertSettings(t);
    const failed = await uploadOk(t, asAda);
    const rejectedAt = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.patch(failed, {
        status: "rejected",
        rejectionKind: "print_failed",
        rejectedAt,
        printRequested: false,
      });
      const settings = await ctx.db.query("settings").first();
      await ctx.db.patch(settings!._id, { submissionsOpen: false });
    });
    vi.setSystemTime(rejectedAt + 1);
    const replacement = await uploadOk(t, asAda);
    await setStatus(t, replacement, { printRequested: false });

    expect((await asAda.query(api.submissions.mine, {}))![0].canUploadReplacement).toBe(false);
    await expect(asAda.mutation(api.submissions.generateUploadUrl, {})).rejects.toThrow(/closed/);
    const { storageId, result } = await upload(t, asAda);
    expect(result).toEqual({ ok: false, error: "Submissions are closed" });
    expect(await storageExists(t, storageId)).toBe(false);
  });

  test("requires a registered participant", async () => {
    const { t } = await setup();
    const stranger = t.withIdentity({ subject: "x", email: "x@example.com", emailVerified: true });
    const storageId = await storeBlob(t);
    await expect(
      stranger.mutation(api.submissions.create, {
        storageId,
        title: "A",
        originalFileName: "a.stl",
        dimensionsMm: KEYCHAIN,
        role: "print",
      })
    ).rejects.toThrow(/Not registered/);
    await expect(t.mutation(api.submissions.generateUploadUrl, {})).rejects.toThrow(/Not registered/);
    expect(await stranger.query(api.submissions.mine, {})).toBeNull();
  });

  test("a storage id can't be reused", async () => {
    const { t, asAda, asGrace } = await setup();
    const { storageId } = await upload(t, asAda);
    const again = await asGrace.mutation(api.submissions.create, {
      storageId,
      title: "Copy",
      originalFileName: "copy.stl",
      dimensionsMm: KEYCHAIN,
      role: "print",
    });
    expect(again.ok).toBe(false);
    expect(await storageExists(t, storageId)).toBe(true);
  });
});

describe("replaceFile", () => {
  test("archives the current file, keeps the submission, and withdraws a queued print", async () => {
    const { t, asAda } = await setup();
    const id = await uploadOk(t, asAda, { role: "both" });
    const original = await t.run((ctx) => ctx.db.get(id));
    const oldPreviewStorageId = await storeBlob(t, 12);
    await t.run((ctx) => ctx.db.patch(id, { previewStorageId: oldPreviewStorageId }));
    await t.run((ctx) =>
      ctx.db.patch(id, {
        status: "queued",
        queueOrder: 4,
        queuedAt: Date.now(),
        printer: "P2S",
      })
    );
    const storageId = await storeBlob(t, 20);
    const result = await asAda.mutation(api.submissions.replaceFile, {
      id,
      storageId,
      originalFileName: "rocket-v2.3mf",
      dimensionsMm: KEYCHAIN,
    });
    expect(result).toEqual({ ok: true });
    const current = await t.run((ctx) => ctx.db.get(id));
    expect(current).toMatchObject({
      _id: id,
      printCode: "KC-001",
      title: "Rocket",
      version: 2,
      storageId,
      originalFileName: "rocket-v2.3mf",
      status: "submitted",
      participantNotice: { kind: "replaced", version: 2 },
    });
    expect(current?.queueOrder).toBeUndefined();
    expect(current?.printer).toBeUndefined();
    const versions = await t.run((ctx) => ctx.db.query("submissionVersions").collect());
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      submissionId: id,
      version: 1,
      storageId: original!.storageId,
      previewStorageId: oldPreviewStorageId,
      why: "replaced",
    });
    expect(await storageExists(t, original!.storageId)).toBe(true);
    expect(await storageExists(t, oldPreviewStorageId)).toBe(true);
    expect(await storageExists(t, storageId)).toBe(true);
    expect((await asAda.query(api.submissions.mine, {}))![0]).toMatchObject({ version: 2, active: true });
  });

  test("rejects invalid replacement files without changing the current version", async () => {
    const { t, asAda } = await setup();
    const id = await uploadOk(t, asAda, { role: "both" });
    const original = await t.run((ctx) => ctx.db.get(id));
    await insertSettings(t, { maxFileBytes: 2 * 1024 * 1024 });
    for (const input of [
      { name: "rocket.obj", bytes: 8, dimensionsMm: KEYCHAIN, message: /STL or 3MF/ },
      { name: "large.stl", bytes: 2 * 1024 * 1024 + 1, dimensionsMm: KEYCHAIN, message: /2 MB or smaller/ },
      { name: "oversize.stl", bytes: 3, dimensionsMm: { x: 72, y: 51, z: 40 }, message: /limit is/ },
    ]) {
      const storageId = await storeBlob(t, input.bytes);
      const result = await asAda.mutation(api.submissions.replaceFile, {
        id,
        storageId,
        originalFileName: input.name,
        dimensionsMm: input.dimensionsMm,
      });
      expect(result).toEqual({ ok: false, error: expect.stringMatching(input.message) });
      expect(await storageExists(t, storageId)).toBe(false);
      expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
        version: 1,
        storageId: original!.storageId,
      });
    }
    expect(await t.run((ctx) => ctx.db.query("submissionVersions").collect())).toEqual([]);
  });

  test("replaces rejected Vote files and clears the rejection", async () => {
    const { t, asAda } = await setup();
    const id = await uploadOk(t, asAda, { role: "both" });
    await setStatus(t, id, { status: "rejected", rejectionReason: "Thin walls", rejectionKind: "review" });
    const storageId = await storeBlob(t);
    expect(
      await asAda.mutation(api.submissions.replaceFile, {
        id,
        storageId,
        originalFileName: "rocket-fixed.stl",
        dimensionsMm: KEYCHAIN,
      })
    ).toEqual({ ok: true });
    const replaced = await t.run((ctx) => ctx.db.get(id));
    expect(replaced).toMatchObject({
      status: "submitted",
      version: 2,
      designEntry: true,
      printRequested: true,
    });
    expect(replaced?.rejectionReason).toBeUndefined();
    expect(replaced?.rejectionKind).toBeUndefined();
    expect(replaced?.rejectedAt).toBeUndefined();
  });

  test("blocks replacement while printing, after completion, and when submissions are closed", async () => {
    const { t, asAda } = await setup();
    const id = await uploadOk(t, asAda, { role: "both" });
    for (const status of ["printing", "done"] as const) {
      await setStatus(t, id, { status });
      const storageId = await storeBlob(t);
      const result = await asAda.mutation(api.submissions.replaceFile, {
        id,
        storageId,
        originalFileName: "blocked.stl",
        dimensionsMm: KEYCHAIN,
      });
      expect(result).toMatchObject({
        ok: false,
        error: status === "printing" ? /is printing/ : /has been printed/,
      });
      expect(await storageExists(t, storageId)).toBe(false);
    }
    await setStatus(t, id, { status: "submitted" });
    await insertSettings(t, { submissionsOpen: false });
    const storageId = await storeBlob(t);
    expect(
      await asAda.mutation(api.submissions.replaceFile, {
        id,
        storageId,
        originalFileName: "closed.stl",
        dimensionsMm: KEYCHAIN,
      })
    ).toEqual({ ok: false, error: "Submissions are closed" });
    expect(await storageExists(t, storageId)).toBe(false);
  });

  test("staff starting first blocks replacement; replacement first blocks printing", async () => {
    const { t, asAda, asGrace } = await setup();
    await t.run((ctx) => ctx.db.insert("admins", { email: "staff@example.com", role: "staff" }));
    const staff = t.withIdentity({ subject: "staff-user", email: "staff@example.com", emailVerified: true });
    const first = await uploadOk(t, asAda, { role: "print" });
    await setStatus(t, first, { status: "queued", queueOrder: 1 });
    await staff.mutation(api.queue.startPrinting, { id: first });
    const rejectedStorage = await storeBlob(t);
    expect(
      await asAda.mutation(api.submissions.replaceFile, {
        id: first,
        storageId: rejectedStorage,
        originalFileName: "late.stl",
        dimensionsMm: KEYCHAIN,
      })
    ).toEqual({ ok: false, error: "KC-001 is printing. Ask staff for changes." });
    expect(await storageExists(t, rejectedStorage)).toBe(false);

    const second = await uploadOk(t, asGrace, { role: "print" });
    await setStatus(t, second, { status: "queued", queueOrder: 2 });
    const replacementStorage = await storeBlob(t);
    expect(
      await asGrace.mutation(api.submissions.replaceFile, {
        id: second,
        storageId: replacementStorage,
        originalFileName: "early.stl",
        dimensionsMm: KEYCHAIN,
      })
    ).toEqual({ ok: true });
    await expect(staff.mutation(api.queue.startPrinting, { id: second })).rejects.toThrow(/expected queued/);
  });

  test("does not reuse storage kept in a prior version", async () => {
    const { t, asAda } = await setup();
    const id = await uploadOk(t, asAda, { role: "both" });
    const original = await t.run((ctx) => ctx.db.get(id));
    const currentStorageId = await storeBlob(t, 20);
    expect(
      await asAda.mutation(api.submissions.replaceFile, {
        id,
        storageId: currentStorageId,
        originalFileName: "rocket-v2.stl",
        dimensionsMm: KEYCHAIN,
      })
    ).toEqual({ ok: true });
    const result = await asAda.mutation(api.submissions.replaceFile, {
      id,
      storageId: original!.storageId,
      originalFileName: "reused.stl",
      dimensionsMm: KEYCHAIN,
    });
    expect(result).toEqual({ ok: false, error: "That file has already been submitted" });
    expect(await storageExists(t, original!.storageId)).toBe(true);
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ version: 2, storageId: currentStorageId });
  });
});

describe("roles", () => {
  test("setRoles changes the requested roles", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "both" });
    await asAda.mutation(api.submissions.setRoles, { id: a, role: "vote" });
    expect((await asAda.query(api.submissions.mine, {}))![0]).toMatchObject({ vote: true, print: false });
    await asAda.mutation(api.submissions.setRoles, { id: a, role: "print" });
    expect((await asAda.query(api.submissions.mine, {}))![0]).toMatchObject({ vote: false, print: true });
  });

  test("soft deleting a role promotes it to the remaining active file", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "print" });
    const b = await uploadOk(t, asAda, { role: "vote" });
    await asAda.mutation(api.submissions.remove, { id: a });
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.map((s) => [s._id, s.vote, s.print])).toEqual([[b, true, true]]);
    expect(await t.run((ctx) => ctx.db.get(a))).toMatchObject({
      deletedAt: expect.any(Number),
      deletedRoles: { vote: false, print: true },
    });
    expect(await storageExists(t, (await t.run((ctx) => ctx.db.get(a)))!.storageId)).toBe(true);
  });

  test("moving Print away from a queued file withdraws it", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "both" });
    await setStatus(t, a, { status: "queued", queueOrder: 5 });
    await asAda.mutation(api.submissions.setRoles, { id: a, role: "vote" });
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine[0]).toMatchObject({
      status: "submitted",
      vote: true,
      print: false,
      queuePosition: null,
    });
    expect((await t.run((ctx) => ctx.db.get(a)))?.participantNotice).toMatchObject({ kind: "withdrawn" });
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: "queue.withdrawn", submissionId: a })])
    );
    await t.run((ctx) => ctx.db.insert("admins", { email: "staff@example.com", role: "staff" }));
    const staff = t.withIdentity({ subject: "staff-user", email: "staff@example.com", emailVerified: true });
    const withdrawals = await staff.query(api.queue.recentWithdrawals);
    expect(withdrawals).toMatchObject([{ printCode: "KC-001", detail: "print removed" }]);
    expect(JSON.stringify(withdrawals)).not.toContain("ada@example.com");
  });

  test("role changes are blocked while printing or after completion", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "both" });
    for (const status of ["printing", "done"] as const) {
      await setStatus(t, a, { status });
      await expect(asAda.mutation(api.submissions.setRoles, { id: a, role: "vote" })).rejects.toThrow(
        status === "printing" ? /is printing/ : /has been printed/
      );
    }
  });

  test("role changes are blocked when submissions are closed", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "both" });
    await insertSettings(t, { submissionsOpen: false });
    await expect(asAda.mutation(api.submissions.setRoles, { id: a, role: "vote" })).rejects.toThrow(/closed/);
  });

  test("rejected files cannot regain Print and removed designs cannot regain Vote", async () => {
    const { t, asAda } = await setup();
    const rejected = await uploadOk(t, asAda, { role: "vote" });
    await setStatus(t, rejected, { status: "rejected" });
    await expect(asAda.mutation(api.submissions.setRoles, { id: rejected, role: "both" })).rejects.toThrow(
      /print was rejected/
    );

    const removed = await uploadOk(t, asAda, { role: "print" });
    await t.run((ctx) => ctx.db.patch(removed, { designRemoved: true }));
    await expect(asAda.mutation(api.submissions.setRoles, { id: removed, role: "both" })).rejects.toThrow(
      /removed .* from the competition/
    );
  });

  test("soft deletion is blocked while printing, after completion, and when submissions are closed", async () => {
    const { t, asAda } = await setup();
    const id = await uploadOk(t, asAda, { role: "both" });
    for (const status of ["printing", "done"] as const) {
      await setStatus(t, id, { status });
      await expect(asAda.mutation(api.submissions.remove, { id })).rejects.toThrow(
        status === "printing" ? /is printing/ : /has been printed/
      );
      expect((await t.run((ctx) => ctx.db.get(id)))?.deletedAt).toBeUndefined();
    }
    await setStatus(t, id, { status: "submitted" });
    await insertSettings(t, { submissionsOpen: false });
    await expect(asAda.mutation(api.submissions.remove, { id })).rejects.toThrow(/closed/);
    expect((await t.run((ctx) => ctx.db.get(id)))?.deletedAt).toBeUndefined();
  });

  test("edits title, notes and colour while awaiting review", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { colour: "Black" });
    await asAda.mutation(api.submissions.update, { id: a, title: "Star", notes: " hi ", colour: "" });
    const [s] = (await asAda.query(api.submissions.mine, {}))!;
    expect(s).toMatchObject({ title: "Star", notes: "hi" });
    expect(s.colour).toBeUndefined();
  });
});

describe("queue position", () => {
  test("counts queued entries ahead", async () => {
    const { t, asAda, asGrace } = await setup();
    const g1 = await uploadOk(t, asGrace);
    const a1 = await uploadOk(t, asAda);
    const g2 = await uploadOk(t, asGrace);
    await setStatus(t, g1, { status: "queued", queueOrder: 1 });
    await setStatus(t, g2, { status: "printing", queueOrder: 2 });
    await setStatus(t, a1, { status: "queued", queueOrder: 3 });
    const [mine] = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.queuePosition).toBe(2);
  });
});

describe("access control", () => {
  test("participants can't touch each other's entries", async () => {
    const { t, asAda, asGrace } = await setup();
    const a = await uploadOk(t, asAda);
    await expect(asGrace.mutation(api.submissions.update, { id: a, title: "Mine now" })).rejects.toThrow(
      /not found/
    );
    await expect(asGrace.mutation(api.submissions.remove, { id: a })).rejects.toThrow(/not found/);
    await expect(asGrace.mutation(api.submissions.setRoles, { id: a, role: "print" })).rejects.toThrow(/not found/);
    expect(await asGrace.query(api.submissions.mine, {})).toEqual([]);
    const [s] = (await asAda.query(api.submissions.mine, {}))!;
    expect(s.title).toBe("Rocket");
  });
});

async function insertSettings(t: T, patch: Record<string, unknown> = {}) {
  await t.run(async (ctx) => {
    const row = await ctx.db.query("settings").first();
    if (row) {
      await ctx.db.patch(row._id, patch);
      return;
    }
    await ctx.db.insert("settings", {
      submissionsOpen: true,
      votingOpen: true,
      showResultsOnTv: false,
      maxFileBytes: 1024 * 1024,
      colours: ["Black"],
      nextPrintNumber: 1,
      ...patch,
    });
  });
}

describe("dimensions", () => {
  test("stores the measured size and accepts both reference keychains", async () => {
    const { t, asAda } = await setup();
    await uploadOk(t, asAda, { dimensionsMm: KEYCHAIN });
    await uploadOk(t, asAda, { dimensionsMm: { x: 38.5, y: 50, z: 4.5 } });
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.map((s) => s.dimensionsMm)).toEqual([KEYCHAIN, { x: 38.5, y: 50, z: 4.5 }]);
  });

  test("is required by the validator", async () => {
    const { t, asAda } = await setup();
    const storageId = await storeBlob(t);
    await expect(
      asAda.mutation(api.submissions.create, {
        storageId,
        title: "A",
        originalFileName: "a.stl",
        role: "print",
      } as unknown as Parameters<typeof asAda.mutation<typeof api.submissions.create>>[1])
    ).rejects.toThrow(/dimensionsMm/);
  });

  test("rejects invalid measurements and deletes the upload", async () => {
    const { t, asAda } = await setup();
    for (const dimensionsMm of [
      { x: 0, y: 10, z: 10 },
      { x: -1, y: 10, z: 10 },
      { x: Number.NaN, y: 10, z: 10 },
      { x: Number.POSITIVE_INFINITY, y: 10, z: 10 },
    ]) {
      const { storageId, result } = await upload(t, asAda, { dimensionsMm });
      expect(result).toEqual({ ok: false, error: expect.stringMatching(/couldn't measure/) });
      expect(await storageExists(t, storageId)).toBe(false);
    }
    expect(await asAda.query(api.submissions.mine, {})).toEqual([]);
  });

  test("blocks models larger than settings.maxDimensionsMm in any orientation", async () => {
    const { t, asAda } = await setup();
    const { storageId, result } = await upload(t, asAda, { dimensionsMm: { x: 72, y: 51, z: 40 } });
    expect(result).toEqual({
      ok: false,
      error: "Your model is 72 × 51 × 40 mm; the limit is 60 × 60 × 45 mm",
    });
    expect(await storageExists(t, storageId)).toBe(false);
    // Rotated to fit: 45 tall, 60 wide.
    await uploadOk(t, asAda, { dimensionsMm: { x: 45, y: 60, z: 30 } });
  });

  test("uses the configured limit", async () => {
    const { t, asAda } = await setup();
    await insertSettings(t, { maxDimensionsMm: { x: 30, y: 30, z: 30 } });
    const { result } = await upload(t, asAda, { dimensionsMm: KEYCHAIN });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/limit is 30 × 30 × 30 mm/) });
  });
});

describe("deadline", () => {
  test("blocks uploads, edits and swaps after the deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T18:00:00Z"));
    const { t, asAda } = await setup();
    const deadline = new Date("2026-10-01T19:00:00Z").getTime();
    await insertSettings(t, { submissionsDeadline: deadline });
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);

    vi.setSystemTime(deadline);
    await expect(asAda.mutation(api.submissions.generateUploadUrl, {})).rejects.toThrow(/closed/);
    await t.run((ctx) => ctx.db.delete(b));
    const { storageId, result } = await upload(t, asAda);
    expect(result).toEqual({ ok: false, error: "Submissions are closed" });
    expect(await storageExists(t, storageId)).toBe(false);
    await expect(asAda.mutation(api.submissions.update, { id: a, title: "Late" })).rejects.toThrow(/closed/);
  });

  test("swapping an existing entry needs submissions open, filling a vacant one doesn't", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("settings").first();
      await ctx.db.patch(row!._id, { submissionsOpen: false });
    });
    await expect(asAda.mutation(api.submissions.setRoles, { id: b, role: "print" })).rejects.toThrow(/closed/);
    await setStatus(t, a, { status: "rejected", rejectionReason: "Too thin", printRequested: false });
    await expect(asAda.mutation(api.submissions.setRoles, { id: b, role: "print" })).rejects.toThrow(/closed/);
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.find((s) => s._id === b)).toMatchObject({ vote: true, print: false });
  });
});

describe("rejections and the entry", () => {
  test("a failed Print-only file frees its slot and shows the kind", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "print" });
    await setStatus(t, a, { status: "queued", queueOrder: 1 });
    await setStatus(t, a, {
      status: "rejected",
      rejectionKind: "print_failed",
      rejectionReason: "Spaghetti",
      printRequested: false,
    });
    const second = await uploadOk(t, asAda);
    const third = await uploadOk(t, asAda);
    expect((await upload(t, asAda)).result).toEqual({ ok: false, error: expect.stringMatching(/at most 2/) });
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.find((s) => s._id === a)).toMatchObject({
      status: "rejected",
      rejectionKind: "print_failed",
      rejectionReason: "Spaghetti",
    });
    expect(mine.filter((s) => s.printRequested).map((s) => s._id)).toEqual([second]);
    expect(mine.find((s) => s._id === third)).toMatchObject({ printRequested: false, active: true });
  });

  test("a failed Both file keeps its Vote role", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "both" });
    await setStatus(t, a, {
      status: "rejected",
      rejectionKind: "print_failed",
      rejectionReason: "Spaghetti",
      printRequested: false,
    });
    await t.run(async (ctx) => {
      const participant = await ctx.db.query("participants").first();
      expect(await entryFor(ctx, participant!._id)).toMatchObject({ _id: a });
    });
    expect((await asAda.query(api.submissions.mine, {}))![0]).toMatchObject({ vote: true, print: false, active: true });
  });

  test("the other upload isn't promoted when the entry is rejected", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    await setStatus(t, a, { status: "rejected", rejectionKind: "review", rejectionReason: "No ring", printRequested: false });
    let mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.printRequested)).toEqual([]);
    expect(mine.find((s) => s._id === b)).toMatchObject({ changeable: true });
    await asAda.mutation(api.submissions.setRoles, { id: b, role: "print" });
    mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.printRequested).map((s) => s._id)).toEqual([b]);
  });

  test("never more than one active entry per participant", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "both" });
    const b = await uploadOk(t, asAda, { role: "print" });
    const check = async () => {
      const rows = await t.run((ctx) => ctx.db.query("submissions").collect());
      const active = rows.filter((s) => s.status !== "rejected" || Boolean(s.designEntry ?? s.printRequested));
      expect(active.filter((s) => s.designEntry ?? s.printRequested).length).toBeLessThanOrEqual(1);
      expect(active.filter((s) => s.printRequested).length).toBeLessThanOrEqual(1);
      expect(active.every((s) => Boolean(s.designEntry ?? s.printRequested) || s.printRequested)).toBe(true);
    };
    await check();
    await setStatus(t, b, { status: "rejected", printRequested: false });
    await check();
    await asAda.mutation(api.submissions.setRoles, { id: a, role: "print" });
    const c = await uploadOk(t, asAda);
    await check();
    expect((await asAda.query(api.submissions.mine, {}))!.filter((s) => s.vote).map((s) => s._id)).toEqual([c]);
  });
});

describe("vote role", () => {
  const designs = async (user: User) =>
    (await user.query(api.submissions.mine, {}))!.filter((s) => s.vote).map((s) => s._id);

  test("soft deletion promotes Vote, then a new upload can move it", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "vote" });
    const b = await uploadOk(t, asAda, { role: "print" });
    expect(await designs(asAda)).toEqual([a]);
    await asAda.mutation(api.submissions.remove, { id: a });
    expect(await designs(asAda)).toEqual([b]);
    const c = await uploadOk(t, asAda, { role: "vote" });
    expect(await designs(asAda)).toEqual([c]);
    expect((await asAda.query(api.submissions.mine, {}))!.find((s) => s._id === c)).toMatchObject({
      vote: true,
    });
  });

  test("a vote remains active after print rejection and can coexist with a new Print file", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "both" });
    await setStatus(t, a, { status: "rejected", rejectionKind: "review", printRequested: false });
    const b = await uploadOk(t, asAda);
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.vote).map((s) => s._id)).toEqual([a]);
    expect(mine.filter((s) => s.print).map((s) => s._id)).toEqual([b]);
  });

  test("setRoles keeps legacy isDesignEntry behavior for rows without designEntry", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "both" });
    await t.run((ctx) => ctx.db.patch(a, { designEntry: undefined }));
    expect(await designs(asAda)).toEqual([a]);
    await asAda.mutation(api.submissions.setRoles, { id: a, role: "vote" });
    const [submission] = (await asAda.query(api.submissions.mine, {}))!;
    expect(submission).toMatchObject({ designEntry: true, printRequested: false, vote: true, print: false });
    await t.run(async (ctx) => {
      expect(await entryFor(ctx, (await ctx.db.get(a))!.participantId)).toMatchObject({ _id: a });
    });
  });

  test("setRoles only accepts your own active uploads", async () => {
    const { t, asAda, asGrace } = await setup();
    const a = await uploadOk(t, asAda, { role: "vote" });
    const b = await uploadOk(t, asAda, { role: "print" });
    await uploadOk(t, asGrace);
    await expect(asGrace.mutation(api.submissions.setRoles, { id: a, role: "both" })).rejects.toThrow(/not found/);
    await setStatus(t, b, { status: "rejected", rejectionKind: "review" });
    await expect(asAda.mutation(api.submissions.setRoles, { id: b, role: "vote" })).rejects.toThrow(/active uploads/);
    expect(await designs(asAda)).toEqual([a]);
  });

  test("setRoles refuses when submissions are closed", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda, { role: "vote" });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("settings").first();
      await ctx.db.patch(row!._id, { submissionsOpen: false });
    });
    await expect(asAda.mutation(api.submissions.setRoles, { id: a, role: "print" })).rejects.toThrow(/closed/);
    expect(await designs(asAda)).toEqual([a]);
  });
});
