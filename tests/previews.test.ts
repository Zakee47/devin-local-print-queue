import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { isPreviewImage, MAX_PREVIEW_BYTES } from "../lib/preview-image";

const modules = import.meta.glob("../convex/**/*.ts");
const previousOwnerEmail = process.env.OWNER_EMAIL;
const OWNER = "owner@example.com";
const ada = { subject: "ada-user", email: "ada@example.com", emailVerified: true };
const grace = { subject: "grace-user", email: "grace@example.com", emailVerified: true };
const owner = { subject: "owner-user", email: OWNER, emailVerified: true };
const staff = { subject: "staff-user", email: "staff@example.com", emailVerified: true };
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

afterEach(() => {
  vi.useRealTimers();
  if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = previousOwnerEmail;
});

async function setup() {
  process.env.OWNER_EMAIL = OWNER;
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const participantId = await ctx.db.insert("participants", {
      clerkUserId: ada.subject,
      email: ada.email,
      name: "Ada Lovelace",
      displayName: "Ada",
    });
    const otherId = await ctx.db.insert("participants", {
      clerkUserId: grace.subject,
      email: grace.email,
      name: "Grace Hopper",
      displayName: "Grace",
    });
    await ctx.db.insert("admins", { email: staff.email, role: "staff" });
    return { participantId, otherId };
  });
  return {
    t,
    ...ids,
    asAda: t.withIdentity(ada),
    asGrace: t.withIdentity(grace),
    asOwner: t.withIdentity(owner),
    asStaff: t.withIdentity(staff),
  };
}

function pngBlob(size = 24) {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_HEADER);
  return new Blob([bytes]);
}

async function storeBlob(t: Awaited<ReturnType<typeof setup>>["t"], blob = new Blob(["model"])) {
  return await t.run((ctx) => ctx.storage.store(blob));
}

async function storageExists(t: Awaited<ReturnType<typeof setup>>["t"], id: Id<"_storage">) {
  return await t.run(async (ctx) => (await ctx.db.system.get("_storage", id)) !== null);
}

async function createSubmission(
  t: Awaited<ReturnType<typeof setup>>["t"],
  asAda: Awaited<ReturnType<typeof setup>>["asAda"],
  options: {
    name?: string;
    previewStorageId?: Id<"_storage">;
    title?: string;
  } = {}
) {
  const storageId = await storeBlob(t);
  const result = await asAda.mutation(api.submissions.create, {
    storageId,
    ...(options.previewStorageId ? { previewStorageId: options.previewStorageId } : {}),
    title: options.title ?? "Rocket",
    originalFileName: options.name ?? "rocket.stl",
    dimensionsMm: { x: 27, y: 51, z: 40 },
  });
  return { storageId, result };
}

async function addSubmission(
  t: Awaited<ReturnType<typeof setup>>["t"],
  participantId: Id<"participants">,
  options: {
    status?: "submitted" | "rejected" | "queued" | "printing" | "done";
    previewStorageId?: Id<"_storage">;
    printRequested?: boolean;
    printCode?: string;
  } = {}
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["model"]));
    return await ctx.db.insert("submissions", {
      participantId,
      storageId,
      ...(options.previewStorageId ? { previewStorageId: options.previewStorageId } : {}),
      originalFileName: "rocket.stl",
      kind: "stl",
      sizeBytes: 5,
      title: "Rocket",
      printRequested: options.printRequested ?? true,
      status: options.status ?? "submitted",
      printCode: options.printCode ?? "KC-001",
    });
  });
}

describe("preview image validation", () => {
  test("recognizes PNG, JPEG and WebP signatures but rejects random and short input", () => {
    expect(isPreviewImage(PNG_HEADER)).toBe(true);
    expect(isPreviewImage(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true);
    expect(
      isPreviewImage(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
      )
    ).toBe(true);
    expect(isPreviewImage(new Uint8Array([1, 2, 3, 4]))).toBe(false);
    expect(isPreviewImage(new Uint8Array([0x89, 0x50, 0x4e]))).toBe(false);
  });
});

describe("preview lifecycle", () => {
  test("attaches a valid PNG after scheduled verification and exposes its URL", async () => {
    vi.useFakeTimers();
    const { t, asAda } = await setup();
    const previewStorageId = await storeBlob(t, pngBlob());
    const { result } = await createSubmission(t, asAda, { previewStorageId });
    expect(result.ok).toBe(true);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const mine = await asAda.query(api.submissions.mine, {});
    expect(mine?.[0].previewUrl).toBeTruthy();
    expect(JSON.stringify(mine)).not.toContain("previewStorageId");
  });

  test("creates the submission but deletes a non-image preview", async () => {
    vi.useFakeTimers();
    const { t, asAda } = await setup();
    const previewStorageId = await storeBlob(t, new Blob(["not an image"]));
    const { result } = await createSubmission(t, asAda, { previewStorageId });
    expect(result.ok).toBe(true);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await asAda.query(api.submissions.mine, {}))?.[0].previewUrl).toBeNull();
    expect(await storageExists(t, previewStorageId)).toBe(false);
  });

  test("deletes an oversized preview without failing submission creation", async () => {
    const { t, asAda } = await setup();
    const bytes = new Uint8Array(MAX_PREVIEW_BYTES + 1);
    bytes.set(PNG_HEADER);
    const previewStorageId = await storeBlob(t, new Blob([bytes]));
    const { result } = await createSubmission(t, asAda, { previewStorageId });
    expect(result.ok).toBe(true);
    expect(await storageExists(t, previewStorageId)).toBe(false);
    expect((await asAda.query(api.submissions.mine, {}))?.[0].previewUrl).toBeNull();
  });

  test("deletes both uploaded blobs when model validation fails", async () => {
    const { t, asAda } = await setup();
    const previewStorageId = await storeBlob(t, pngBlob());
    const { storageId, result } = await createSubmission(t, asAda, {
      name: "rocket.obj",
      previewStorageId,
    });
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/STL or 3MF/) });
    expect(await storageExists(t, storageId)).toBe(false);
    expect(await storageExists(t, previewStorageId)).toBe(false);
  });

  test("does not delete another submission's model when passed as the preview", async () => {
    const { t, asAda, participantId } = await setup();
    const first = await addSubmission(t, participantId);
    const { result } = await createSubmission(t, asAda, {
      previewStorageId: (await t.run((ctx) => ctx.db.get(first)))!.storageId,
    });
    expect(result.ok).toBe(true);
    expect(await storageExists(t, (await t.run((ctx) => ctx.db.get(first)))!.storageId)).toBe(true);
    expect((await asAda.query(api.submissions.mine, {}))?.[1].previewUrl).toBeNull();
  });

  test("removing a submission deletes its preview blob", async () => {
    vi.useFakeTimers();
    const { t, asAda } = await setup();
    const previewStorageId = await storeBlob(t, pngBlob());
    const { result } = await createSubmission(t, asAda, { previewStorageId });
    if (!result.ok) throw new Error(result.error);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await asAda.mutation(api.submissions.remove, { id: result.id });
    expect(await storageExists(t, previewStorageId)).toBe(false);
  });

  test("owner account deletion removes participant preview blobs", async () => {
    const { t, asOwner, participantId } = await setup();
    const previewStorageId = await storeBlob(t, pngBlob());
    await addSubmission(t, participantId, { previewStorageId });
    await asOwner.mutation(api.accounts.deleteParticipant, {
      participantId,
      block: false,
    });
    expect(await storageExists(t, previewStorageId)).toBe(false);
  });

  test("setPreview is admin-only, audits, replaces old previews, and rejects non-images", async () => {
    vi.useFakeTimers();
    const { t, asAda, asStaff, participantId } = await setup();
    const submissionId = await addSubmission(t, participantId);
    const firstPreview = await storeBlob(t, pngBlob());
    await expect(
      asAda.mutation(api.submissions.setPreview, { id: submissionId, previewStorageId: firstPreview })
    ).rejects.toThrow();
    await asStaff.mutation(api.submissions.setPreview, {
      id: submissionId,
      previewStorageId: firstPreview,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const secondPreview = await storeBlob(t, pngBlob());
    await asStaff.mutation(api.submissions.setPreview, {
      id: submissionId,
      previewStorageId: secondPreview,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await storageExists(t, firstPreview)).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(submissionId)))?.previewStorageId).toBe(secondPreview);
    const invalidPreview = await storeBlob(t, new Blob(["nope"]));
    await asStaff.mutation(api.submissions.setPreview, {
      id: submissionId,
      previewStorageId: invalidPreview,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await storageExists(t, invalidPreview)).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(submissionId)))?.previewStorageId).toBe(secondPreview);
    expect(
      await t.run(async (ctx) =>
        (await ctx.db.query("auditLog").collect())
          .filter((row) => row.action === "submission.preview")
          .map(({ actor, action, submissionId: loggedId }) => ({ actor, action, submissionId: loggedId }))
      )
    ).toEqual([
      { actor: staff.email, action: "submission.preview", submissionId },
      { actor: staff.email, action: "submission.preview", submissionId },
      { actor: staff.email, action: "submission.preview", submissionId },
    ]);
  });

  test("update replaces a valid preview and deletes the old blob", async () => {
    vi.useFakeTimers();
    const { t, asAda } = await setup();
    const firstPreview = await storeBlob(t, pngBlob());
    const { result } = await createSubmission(t, asAda, { previewStorageId: firstPreview });
    if (!result.ok) throw new Error(result.error);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const secondPreview = await storeBlob(t, pngBlob());
    await asAda.mutation(api.submissions.update, {
      id: result.id,
      title: "Rocket",
      previewStorageId: secondPreview,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await storageExists(t, firstPreview)).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(result.id)))?.previewStorageId).toBe(secondPreview);
  });

  test("missingPreviews requires an admin and excludes rejected or already-previewed entries", async () => {
    const { t, asAda, asOwner, participantId } = await setup();
    const previewStorageId = await storeBlob(t, pngBlob());
    const missing = await addSubmission(t, participantId, { printCode: "KC-001" });
    await addSubmission(t, participantId, { previewStorageId, printCode: "KC-002" });
    await addSubmission(t, participantId, { status: "rejected", printCode: "KC-003" });
    await expect(asAda.query(api.submissions.missingPreviews, {})).rejects.toThrow();
    expect(await asOwner.query(api.submissions.missingPreviews, {})).toMatchObject([
      { _id: missing, printCode: "KC-001", kind: "stl" },
    ]);
  });

  test("gallery, participant, TV, and queue surfaces expose preview URLs without preview storage IDs publicly", async () => {
    const { t, asAda, asOwner, participantId } = await setup();
    const previewStorageId = await storeBlob(t, pngBlob());
    const submissionId = await addSubmission(t, participantId, {
      status: "printing",
      previewStorageId,
      printCode: "KC-001",
    });
    const gallery = await t.query(api.votes.gallery);
    expect(gallery[0].previewUrl).toBeTruthy();
    expect(JSON.stringify(gallery)).not.toContain('"previewStorageId"');
    expect(JSON.stringify(gallery)).not.toContain('"storageId"');

    const mine = await asAda.query(api.submissions.mine, {});
    expect(mine?.[0].previewUrl).toBeTruthy();
    expect(JSON.stringify(mine)).not.toContain('"previewStorageId"');

    const tv = await t.query(api.tv.board);
    if (tv.mode !== "queue") throw new Error("expected queue mode");
    expect(tv.printing[0].previewUrl).toBeTruthy();
    const [queueRow] = await asOwner.query(api.queue.board, {});
    expect(queueRow).toMatchObject({ _id: submissionId });
    expect(queueRow.previewUrl).toBeTruthy();
  });
});
