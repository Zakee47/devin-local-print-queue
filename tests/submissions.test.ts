import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

const modules = import.meta.glob("../convex/**/*.ts");

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
  });
  const asAda = t.withIdentity(ada);
  const asGrace = t.withIdentity(grace);
  await asAda.mutation(api.participants.register, {});
  await asGrace.mutation(api.participants.register, {});
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
  opts: { name?: string; title?: string; colour?: string; bytes?: number } = {}
) {
  const storageId = await storeBlob(t, opts.bytes);
  const result = await user.mutation(api.submissions.create, {
    storageId,
    title: opts.title ?? "Rocket",
    colour: opts.colour,
    originalFileName: opts.name ?? "rocket.stl",
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
  patch: Partial<{ status: "queued" | "rejected" | "printing" | "done"; queueOrder: number; rejectionReason: string }>
) {
  await t.run((ctx) => ctx.db.patch(id, patch));
}

async function storageExists(t: T, storageId: Id<"_storage">) {
  return await t.run(async (ctx) => (await ctx.db.system.get(storageId)) !== null);
}

describe("create", () => {
  test("allocates print codes and requests the first entry", async () => {
    const { t, asAda } = await setup();
    await uploadOk(t, asAda, { title: "  One  ", colour: "red" });
    await uploadOk(t, asAda, { title: "Two", name: "two.3MF" });
    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine.map((s) => [s.printCode, s.title, s.kind, s.colour, s.printRequested])).toEqual([
      ["KC-001", "One", "stl", "Red", true],
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
    await t.run((ctx) =>
      ctx.db.insert("settings", {
        submissionsOpen: true,
        votingOpen: false,
        showResultsOnTv: false,
        maxFileBytes: 1024 * 1024,
        colours: ["Red"],
        nextPrintNumber: 1,
      })
    );
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
    await t.run((ctx) =>
      ctx.db.insert("settings", {
        submissionsOpen: false,
        votingOpen: false,
        showResultsOnTv: false,
        maxFileBytes: 1024 * 1024,
        colours: [],
        nextPrintNumber: 1,
      })
    );
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
      stranger.mutation(api.submissions.create, { storageId, title: "A", originalFileName: "a.stl" })
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
    const a = await uploadOk(t, asAda, { colour: "Red" });
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
