import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";
import { entryFor } from "../convex/entries";

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
  } = {}
) {
  const storageId = await storeBlob(t, opts.bytes);
  const result = await user.mutation(api.submissions.create, {
    storageId,
    title: opts.title ?? "Rocket",
    colour: opts.colour,
    originalFileName: opts.name ?? "rocket.stl",
    dimensionsMm: opts.dimensionsMm ?? KEYCHAIN,
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
    status: "queued" | "rejected" | "printing" | "done";
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
  test("allocates print codes and requests the first entry", async () => {
    const { t, asAda } = await setup();
    await uploadOk(t, asAda, { title: "  One  ", colour: "black" });
    await uploadOk(t, asAda, { title: "Two", name: "two.3MF" });
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.map((s) => [s.printCode, s.title, s.kind, s.colour, s.printRequested])).toEqual([
      ["KC-001", "One", "stl", "Black", true],
      ["KC-002", "Two", "3mf", undefined, false],
    ]);
    expect(mine[0].fileUrl).toBeTruthy();
    expect(mine.every((s) => s.status === "submitted")).toBe(true);
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

  test("a rejected entry frees a slot and the new entry takes the print request", async () => {
    const { t, asAda } = await setup();
    const first = await uploadOk(t, asAda);
    await uploadOk(t, asAda);
    await setStatus(t, first, { status: "rejected", rejectionReason: "Too big" });
    await t.run((ctx) => ctx.db.patch(first, { printRequested: false }));
    const third = await uploadOk(t, asAda);
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.status !== "rejected")).toHaveLength(2);
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
    });
    expect(again.ok).toBe(false);
    expect(await storageExists(t, storageId)).toBe(true);
  });
});

describe("print choice", () => {
  test("exactly one active entry is requested when switching", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    await asAda.mutation(api.submissions.setPrintRequested, { id: b });
    let mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.printRequested).map((s) => s._id)).toEqual([b]);
    await asAda.mutation(api.submissions.setPrintRequested, { id: a });
    mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.printRequested).map((s) => s._id)).toEqual([a]);
  });

  test("deleting the requested entry hands the request to the other", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    await asAda.mutation(api.submissions.remove, { id: a });
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.map((s) => [s._id, s.printRequested])).toEqual([[b, true]]);
  });

  test("locks editing and the choice once an entry is queued", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    await setStatus(t, a, { status: "queued", queueOrder: 5 });

    await expect(asAda.mutation(api.submissions.setPrintRequested, { id: b })).rejects.toThrow(/locked/);
    await expect(
      asAda.mutation(api.submissions.update, { id: a, title: "New" })
    ).rejects.toThrow(/can't be changed/);
    await expect(asAda.mutation(api.submissions.remove, { id: a })).rejects.toThrow(/can't be changed/);

    const mine = (await asAda.query(api.submissions.mine, {}))!;
    const queued = mine.find((s) => s._id === a)!;
    expect(queued).toMatchObject({ editable: false, canChoose: false, title: "Rocket", printRequested: true });
    expect(mine.find((s) => s._id === b)).toMatchObject({ editable: true, canChoose: false });
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
    await expect(asGrace.mutation(api.submissions.setPrintRequested, { id: a })).rejects.toThrow(/not found/);
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
    await expect(asAda.mutation(api.submissions.setPrintRequested, { id: b })).rejects.toThrow(/closed/);
    await setStatus(t, a, { status: "rejected", rejectionReason: "Too thin", printRequested: false });
    await asAda.mutation(api.submissions.setPrintRequested, { id: b });
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.printRequested).map((s) => s._id)).toEqual([b]);
  });
});

describe("rejections and the entry", () => {
  test("a failed print frees the slot and the print request, keeps the design entry, and shows the kind", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    await setStatus(t, a, { status: "queued", queueOrder: 1 });
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
    expect(mine.find((s) => s._id === third)).toMatchObject({ printRequested: false, canChoose: true });
  });

  test("the other upload isn't promoted when the entry is rejected", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    await setStatus(t, a, { status: "rejected", rejectionKind: "review", rejectionReason: "No ring", printRequested: false });
    let mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.printRequested)).toEqual([]);
    expect(mine.find((s) => s._id === b)).toMatchObject({ canChoose: true });
    await asAda.mutation(api.submissions.setPrintRequested, { id: b });
    mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.printRequested).map((s) => s._id)).toEqual([b]);
  });

  test("never more than one active entry per participant", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    const check = async () => {
      const rows = await t.run((ctx) => ctx.db.query("submissions").collect());
      expect(rows.filter((s) => s.printRequested && s.status !== "rejected").length).toBeLessThanOrEqual(1);
    };
    await check();
    await asAda.mutation(api.submissions.setPrintRequested, { id: b });
    await check();
    await setStatus(t, b, { status: "rejected", printRequested: false });
    await check();
    await asAda.mutation(api.submissions.setPrintRequested, { id: a });
    await uploadOk(t, asAda);
    await check();
    const rows = await t.run((ctx) => ctx.db.query("submissions").collect());
    expect(rows.filter((s) => s.printRequested && s.status !== "rejected").map((s) => s._id)).toEqual([a]);
  });
});

describe("design entry", () => {
  const designs = async (user: User) =>
    (await user.query(api.submissions.mine, {}))!.filter((s) => s.designEntry).map((s) => s._id);

  test("the first upload becomes the design entry, later ones don't", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    expect(await designs(asAda)).toEqual([a]);
    await asAda.mutation(api.submissions.remove, { id: a });
    expect(await designs(asAda)).toEqual([b]);
    const c = await uploadOk(t, asAda);
    expect(await designs(asAda)).toEqual([b]);
    expect((await asAda.query(api.submissions.mine, {}))!.find((s) => s._id === c)).toMatchObject({
      designEntry: false,
    });
  });

  test("a new upload doesn't take over a design entry whose print was rejected", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    await setStatus(t, a, { status: "rejected", rejectionKind: "review", printRequested: false });
    const b = await uploadOk(t, asAda);
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.designEntry).map((s) => s._id)).toEqual([a]);
    expect(mine.filter((s) => s.printRequested).map((s) => s._id)).toEqual([b]);
  });

  test("setDesignEntry keeps one per participant and leaves the print request alone", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    await asAda.mutation(api.submissions.setDesignEntry, { submissionId: b });
    let mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.designEntry).map((s) => s._id)).toEqual([b]);
    expect(mine.filter((s) => s.printRequested).map((s) => s._id)).toEqual([a]);
    await t.run(async (ctx) => {
      expect(await entryFor(ctx, (await ctx.db.get(b))!.participantId)).toMatchObject({ _id: b });
    });
    // Not gated on staff review: works after the print request is queued.
    await setStatus(t, a, { status: "queued", queueOrder: 1 });
    await asAda.mutation(api.submissions.setDesignEntry, { submissionId: a });
    mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.designEntry).map((s) => s._id)).toEqual([a]);
  });

  test("setDesignEntry only accepts your own active uploads", async () => {
    const { t, asAda, asGrace } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    await uploadOk(t, asGrace);
    await expect(asGrace.mutation(api.submissions.setDesignEntry, { submissionId: a })).rejects.toThrow(/not found/);
    await setStatus(t, b, { status: "rejected", rejectionKind: "review" });
    await expect(asAda.mutation(api.submissions.setDesignEntry, { submissionId: b })).rejects.toThrow(/active uploads/);
    expect(await designs(asAda)).toEqual([a]);
  });

  test("setDesignEntry refuses when submissions are closed", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("settings").first();
      await ctx.db.patch(row!._id, { submissionsOpen: false });
    });
    await expect(asAda.mutation(api.submissions.setDesignEntry, { submissionId: b })).rejects.toThrow(/closed/);
    expect(await designs(asAda)).toEqual([a]);
  });

  test("moving the print request doesn't move a legacy row's design entry", async () => {
    const { t, asAda } = await setup();
    const a = await uploadOk(t, asAda);
    const b = await uploadOk(t, asAda);
    // Rows created before designEntry existed only have printRequested.
    await t.run(async (ctx) => {
      await ctx.db.patch(a, { designEntry: undefined });
      await ctx.db.patch(b, { designEntry: undefined });
    });
    expect(await designs(asAda)).toEqual([a]);
    await asAda.mutation(api.submissions.setPrintRequested, { id: b });
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.filter((s) => s.designEntry).map((s) => s._id)).toEqual([a]);
    expect(mine.filter((s) => s.printRequested).map((s) => s._id)).toEqual([b]);
  });
});
