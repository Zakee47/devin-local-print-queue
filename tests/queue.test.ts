import { convexTest } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { entryFor } from "../convex/entries";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const admin = { subject: "admin-user", email: "admin@example.com", emailVerified: true };
const guest = { subject: "guest-user", email: "ada@example.com", emailVerified: true };
const previousOwnerEmail = process.env.OWNER_EMAIL;

afterEach(() => {
  if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = previousOwnerEmail;
});

type Status = "submitted" | "rejected" | "queued" | "printing" | "done";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("admins", { email: admin.email });
    const participantId = await ctx.db.insert("participants", {
      clerkUserId: guest.subject,
      email: guest.email,
      name: "Ada Lovelace",
      displayName: "Ada L.",
    });
    const otherId = await ctx.db.insert("participants", {
      clerkUserId: "grace-user",
      email: "grace@example.com",
      name: "Grace Hopper",
      displayName: "Grace H.",
    });
    return { participantId, otherId };
  });
  let n = 0;
  const addSubmission = (
    participantId: Id<"participants">,
    opts: {
      printRequested?: boolean;
      status?: Status;
      title?: string;
      colour?: string;
      dimensionsMm?: { x: number; y: number; z: number };
    } = {}
  ) =>
    t.run(async (ctx) => {
      n += 1;
      const storageId = await ctx.storage.store(new Blob([`solid model-${n}`]));
      return await ctx.db.insert("submissions", {
        participantId,
        storageId,
        originalFileName: `model-${n}.stl`,
        kind: "stl",
        sizeBytes: 12,
        title: opts.title ?? `Rocket ${n}`,
        colour: opts.colour ?? "Red",
        dimensionsMm: opts.dimensionsMm,
        printRequested: opts.printRequested ?? true,
        status: opts.status ?? "submitted",
        printCode: `KC-${String(n).padStart(3, "0")}`,
      });
    });
  const get = (id: Id<"submissions">) => t.run((ctx) => ctx.db.get(id));
  return { t, as: t.withIdentity(admin), ...ids, addSubmission, get };
}

describe("state machine", () => {
  test("approve → printing → done, with audit rows and queue order", async () => {
    const { t, as, participantId, otherId, addSubmission, get } = await setup();
    const a = await addSubmission(participantId);
    const b = await addSubmission(otherId);
    await as.mutation(api.queue.approve, { id: a });
    await as.mutation(api.queue.approve, { id: b });
    expect((await get(a))?.queueOrder).toBe(1);
    expect((await get(b))?.queueOrder).toBe(2);
    expect((await get(a))?.status).toBe("queued");

    await as.mutation(api.queue.startPrinting, { id: a });
    expect((await get(a))?.status).toBe("printing");
    await as.mutation(api.queue.markDone, { id: a });
    expect((await get(a))?.status).toBe("done");
    expect(await as.query(api.queue.counts)).toEqual({ review: 0, queued: 1, printing: 0, done: 1 });

    const log = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(log.map((l) => l.action)).toEqual([
      "queue.approve",
      "queue.approve",
      "queue.startPrinting",
      "queue.markDone",
    ]);
  });

  test("invalid transitions are rejected", async () => {
    const { as, participantId, addSubmission } = await setup();
    const a = await addSubmission(participantId);
    await expect(as.mutation(api.queue.startPrinting, { id: a })).rejects.toThrow();
    await expect(as.mutation(api.queue.markDone, { id: a })).rejects.toThrow();
    await as.mutation(api.queue.approve, { id: a });
    await expect(as.mutation(api.queue.approve, { id: a })).rejects.toThrow();
    await expect(as.mutation(api.queue.markDone, { id: a })).rejects.toThrow();
  });

  test("moveBack undoes one step at a time", async () => {
    const { as, participantId, addSubmission, get } = await setup();
    const a = await addSubmission(participantId);
    await as.mutation(api.queue.approve, { id: a });
    await as.mutation(api.queue.startPrinting, { id: a });
    await as.mutation(api.queue.markDone, { id: a });
    for (const expected of ["printing", "queued", "submitted"]) {
      await as.mutation(api.queue.moveBack, { id: a });
      expect((await get(a))?.status).toBe(expected);
    }
    expect((await get(a))?.queueOrder).toBeUndefined();
    await expect(as.mutation(api.queue.moveBack, { id: a })).rejects.toThrow();
  });

  test("move up/down swaps queue order", async () => {
    const { as, participantId, otherId, addSubmission, get } = await setup();
    const a = await addSubmission(participantId);
    const b = await addSubmission(otherId);
    await as.mutation(api.queue.approve, { id: a });
    await as.mutation(api.queue.approve, { id: b });
    await as.mutation(api.queue.move, { id: b, direction: "up" });
    expect((await get(b))?.queueOrder).toBe(1);
    expect((await get(a))?.queueOrder).toBe(2);
    await as.mutation(api.queue.move, { id: b, direction: "up" });
    expect((await get(b))?.queueOrder).toBe(1);
  });
});

describe("reject", () => {
  test("requires a comment", async () => {
    const { as, participantId, addSubmission, get } = await setup();
    const a = await addSubmission(participantId);
    await expect(as.mutation(api.queue.reject, { id: a, reason: "   " })).rejects.toThrow(
      /comment is required/
    );
    expect((await get(a))?.status).toBe("submitted");
    await as.mutation(api.queue.reject, { id: a, reason: " Walls too thin " });
    const rejected = await get(a);
    expect(rejected?.status).toBe("rejected");
    expect(rejected?.rejectionReason).toBe("Walls too thin");
    expect(rejected?.rejectionKind).toBe("review");
  });

  test("undoing a rejection restores it to review", async () => {
    const { as, participantId, addSubmission, get } = await setup();
    const a = await addSubmission(participantId);
    await as.mutation(api.queue.reject, { id: a, reason: "Mesh errors" });
    await as.mutation(api.queue.moveBack, { id: a });
    const restored = await get(a);
    expect(restored?.status).toBe("submitted");
    expect(restored?.rejectionReason).toBeUndefined();
    expect(restored?.rejectionKind).toBeUndefined();
    expect(restored?.printRequested).toBe(true);
  });
});

describe("printer assignments", () => {
  test("startPrinting normalizes a configured printer, permits no printer, and rejects unknown names", async () => {
    const { t, as, participantId, otherId, addSubmission, get } = await setup();
    const assigned = await addSubmission(participantId, { status: "queued" });
    await as.mutation(api.queue.startPrinting, { id: assigned, printer: " ultimaker " });
    expect((await get(assigned))?.printer).toBe("Ultimaker");
    const startAudit = await t.run(async (ctx) =>
      (await ctx.db.query("auditLog").collect()).find((row) => row.action === "queue.startPrinting")
    );
    expect(startAudit?.detail).toBe("Ultimaker");

    const unset = await addSubmission(otherId, { status: "queued" });
    await as.mutation(api.queue.startPrinting, { id: unset });
    expect((await get(unset))?.printer).toBeUndefined();

    const unknown = await addSubmission(participantId, { status: "queued" });
    await expect(
      as.mutation(api.queue.startPrinting, { id: unknown, printer: "Unknown printer" })
    ).rejects.toThrow(/Unknown printer/);
  });

  test("setPrinter updates printing and done jobs, clears blank values, and enforces access and status", async () => {
    const { t, as, participantId, otherId, addSubmission, get } = await setup();
    const printing = await addSubmission(participantId, { status: "printing" });
    await as.mutation(api.queue.setPrinter, { id: printing, printer: " muon 1 " });
    expect((await get(printing))?.printer).toBe("Muon 1");
    await as.mutation(api.queue.setPrinter, { id: printing, printer: "   " });
    expect((await get(printing))?.printer).toBeUndefined();

    const done = await addSubmission(otherId, { status: "done" });
    await as.mutation(api.queue.setPrinter, { id: done, printer: "creality" });
    expect((await get(done))?.printer).toBe("Creality");

    const queued = await addSubmission(participantId, { status: "queued" });
    await expect(as.mutation(api.queue.setPrinter, { id: queued, printer: "Creality" })).rejects.toThrow();
    await expect(
      t.withIdentity(guest).mutation(api.queue.setPrinter, { id: printing, printer: "Creality" })
    ).rejects.toThrow();

    const audit = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(audit.filter((row) => row.action === "queue.setPrinter").map((row) => row.detail)).toEqual([
      "Muon 1",
      "cleared",
      "Creality",
    ]);
  });

  test("moving a printing job back to queued clears its printer", async () => {
    const { as, participantId, addSubmission, get } = await setup();
    const id = await addSubmission(participantId, { status: "printing" });
    await as.mutation(api.queue.setPrinter, { id, printer: "Ultimaker" });
    await as.mutation(api.queue.moveBack, { id });
    expect((await get(id))?.status).toBe("queued");
    expect((await get(id))?.printer).toBeUndefined();
  });

  test("multiple jobs can print on the same or different printers", async () => {
    const { as, participantId, addSubmission, get } = await setup();
    const jobs = await Promise.all(
      Array.from({ length: 3 }, () => addSubmission(participantId, { status: "queued" }))
    );
    await as.mutation(api.queue.startPrinting, { id: jobs[0], printer: "Creality" });
    await as.mutation(api.queue.startPrinting, { id: jobs[1], printer: "Creality" });
    await as.mutation(api.queue.startPrinting, { id: jobs[2], printer: "Ultimaker" });
    expect(await Promise.all(jobs.map(async (id) => (await get(id))?.printer))).toEqual([
      "Creality",
      "Creality",
      "Ultimaker",
    ]);
    expect((await Promise.all(jobs.map(get))).every((job) => job?.status === "printing")).toBe(true);
  });

  test("printer options prioritize printers loaded with the requested colour", async () => {
    const { as, participantId, addSubmission } = await setup();
    await as.mutation(api.settings.update, {
      printers: [
        { name: "Creality", colours: ["Red"] },
        { name: "Ultimaker", colours: ["Silver"] },
        { name: "Muon 1", colours: ["Gold"] },
        { name: "Muon 2", colours: ["Black"] },
      ],
    });
    await addSubmission(participantId, { colour: "Gold" });
    const [row] = await as.query(api.queue.board);
    expect(row).toMatchObject({
      printersWithColour: ["Muon 1"],
      printerOptions: ["Muon 1", "Creality", "Ultimaker", "Muon 2"],
    });
  });
});

describe("printFailed", () => {
  test("rejects a printing submission, records the reason, and clears the print entry", async () => {
    const { t, as, participantId, addSubmission, get } = await setup();
    const id = await addSubmission(participantId);
    await as.mutation(api.queue.approve, { id });
    await as.mutation(api.queue.startPrinting, { id });

    await as.mutation(api.queue.printFailed, { id, reason: "  Detached from the bed  " });

    expect(await get(id)).toMatchObject({
      status: "rejected",
      rejectionKind: "print_failed",
      rejectionReason: "Detached from the bed",
      printRequested: false,
    });
    expect(await t.run((ctx) => entryFor(ctx, participantId))).toBeNull();
    const audit = await t.run(async (ctx) =>
      (await ctx.db.query("auditLog").collect()).find((row) => row.action === "queue.printFailed")
    );
    expect(audit).toMatchObject({
      action: "queue.printFailed",
      detail: "Detached from the bed",
    });
  });

  test("requires a non-empty reason and preserves printing status", async () => {
    const { as, participantId, addSubmission, get } = await setup();
    const id = await addSubmission(participantId);
    await as.mutation(api.queue.approve, { id });
    await as.mutation(api.queue.startPrinting, { id });

    await expect(as.mutation(api.queue.printFailed, { id, reason: "   " })).rejects.toThrow(
      /reason is required/
    );
    expect((await get(id))?.status).toBe("printing");
  });

  test.each(["submitted", "queued", "done"] as const)("rejects a %s submission", async (status) => {
    const { as, participantId, addSubmission } = await setup();
    const id = await addSubmission(participantId);
    if (status === "queued" || status === "done") {
      await as.mutation(api.queue.approve, { id });
    }
    if (status === "done") {
      await as.mutation(api.queue.startPrinting, { id });
      await as.mutation(api.queue.markDone, { id });
    }
    await expect(as.mutation(api.queue.printFailed, { id, reason: "Failed mid-print" })).rejects.toThrow();
  });
});

describe("one in pipeline per participant", () => {
  test("approving a second file while the first is in the pipeline errors", async () => {
    const { as, participantId, addSubmission } = await setup();
    const first = await addSubmission(participantId);
    const second = await addSubmission(participantId, { printRequested: false });
    await as.mutation(api.queue.approve, { id: first });
    await expect(as.mutation(api.queue.approve, { id: second })).rejects.toThrow(/already has/);
    await as.mutation(api.queue.startPrinting, { id: first });
    await expect(as.mutation(api.queue.approve, { id: second })).rejects.toThrow(/already has/);
    await as.mutation(api.queue.markDone, { id: first });
    await expect(as.mutation(api.queue.approve, { id: second })).rejects.toThrow(/already has/);
  });

  test("approving the backup file makes it the print", async () => {
    const { as, participantId, addSubmission, get } = await setup();
    const requested = await addSubmission(participantId);
    const backup = await addSubmission(participantId, { printRequested: false });
    await as.mutation(api.queue.approve, { id: backup });
    expect((await get(backup))?.printRequested).toBe(true);
    expect((await get(requested))?.printRequested).toBe(false);
  });

  test("a rejected first file frees the pipeline", async () => {
    const { as, participantId, addSubmission, get } = await setup();
    const first = await addSubmission(participantId);
    const second = await addSubmission(participantId, { printRequested: false });
    await as.mutation(api.queue.approve, { id: first });
    await as.mutation(api.queue.reject, { id: first, reason: "Too large" });
    await as.mutation(api.queue.approve, { id: second });
    expect((await get(second))?.status).toBe("queued");
  });
});

describe("access", () => {
  test("non-admins can't read or change the queue", async () => {
    const { t, participantId, addSubmission } = await setup();
    const a = await addSubmission(participantId);
    const unverified = t.withIdentity({ ...admin, emailVerified: false });
    for (const user of [t, t.withIdentity(guest), unverified]) {
      await expect(user.query(api.queue.board)).rejects.toThrow();
      await expect(user.query(api.queue.counts)).rejects.toThrow();
      await expect(user.mutation(api.queue.approve, { id: a })).rejects.toThrow();
      await expect(user.mutation(api.queue.reject, { id: a, reason: "x" })).rejects.toThrow();
      await expect(user.mutation(api.queue.moveBack, { id: a })).rejects.toThrow();
      await expect(user.mutation(api.queue.move, { id: a, direction: "up" })).rejects.toThrow();
      await expect(user.query(api.guests.list)).rejects.toThrow();
    }
  });

  test("staff board includes public participant details but omits email", async () => {
    const { as, participantId, addSubmission } = await setup();
    await addSubmission(participantId, { title: "Rocket Keychain" });
    const [row] = await as.query(api.queue.board);
    expect(row.participantUsername).toBe("Ada L.");
    expect(row.participantName).toBe("Ada Lovelace");
    expect("participantEmail" in row).toBe(false);
    expect(row.downloadName).toBe("KC-001_ada-lovelace_red_rocket-keychain.stl");
    expect(row.fileUrl).toBeTruthy();
  });

  test("owner board includes participant email", async () => {
    process.env.OWNER_EMAIL = "owner@example.com";
    const { t, participantId, addSubmission } = await setup();
    const owner = t.withIdentity({ subject: "owner-user", email: "owner@example.com", emailVerified: true });
    await addSubmission(participantId);
    const [row] = await owner.query(api.queue.board);
    expect(row.participantEmail).toBe(guest.email);
  });

  test("board reports loaded colours and dimensions against settings", async () => {
    const { as, participantId, addSubmission } = await setup();
    await as.mutation(api.settings.update, {
      printers: [
        { name: "Creality", colours: ["Red"] },
        { name: "Muon 1", colours: ["red"] },
        { name: "Ultimaker", colours: [] },
      ],
      maxDimensionsMm: { x: 60, y: 60, z: 45 },
    });
    await addSubmission(participantId, {
      colour: "Red",
      dimensionsMm: { x: 70, y: 10, z: 10 },
    });
    await addSubmission(participantId, {
      colour: "Purple",
      dimensionsMm: { x: 27, y: 51, z: 40 },
    });
    await addSubmission(participantId, { colour: "Red" });

    const rows = await as.query(api.queue.board);
    expect(rows[0]).toMatchObject({
      printersWithColour: ["Creality", "Muon 1"],
      oversize: true,
    });
    expect(rows[1]).toMatchObject({ printersWithColour: [], oversize: false });
    expect(rows[2]).toMatchObject({ oversize: false });
  });

  test("guests.list flags registered guests", async () => {
    process.env.OWNER_EMAIL = "owner@example.com";
    const { t } = await setup();
    const owner = t.withIdentity({ subject: "owner-user", email: "owner@example.com", emailVerified: true });
    await t.run(async (ctx) => {
      const importId = await ctx.db.insert("guestImports", {
        fileName: "x.csv",
        uploadedBy: admin.email,
        rowCount: 2,
        eligibleCount: 2,
        hasCheckInColumn: true,
      });
      await ctx.db.insert("guests", { email: guest.email, checkedIn: true, importId });
      await ctx.db.insert("guests", { email: "zed@example.com", checkedIn: false, importId });
    });
    const list = await owner.query(api.guests.list);
    expect(list.map((g) => [g.email, g.registered])).toEqual([
      [guest.email, true],
      ["zed@example.com", false],
    ]);
  });

  test("staff cannot manage guests, while the owner can import and list them", async () => {
    process.env.OWNER_EMAIL = "owner@example.com";
    const { t, as } = await setup();
    const owner = t.withIdentity({ subject: "owner-user", email: "owner@example.com", emailVerified: true });
    const importArgs = {
      fileName: "luma.csv",
      rowCount: 1,
      hasCheckInColumn: false,
      guests: [{ email: "Ada@Example.com", name: "Ada Lovelace", checkedIn: true }],
    };

    await expect(as.mutation(api.guests.importCsv, importArgs)).rejects.toThrow("Owner only");
    await expect(as.query(api.guests.list)).rejects.toThrow("Owner only");
    await expect(as.query(api.guests.latestImport)).rejects.toThrow("Owner only");

    await owner.mutation(api.guests.importCsv, importArgs);
    expect(await owner.query(api.guests.list)).toMatchObject([
      { email: "ada@example.com", name: "Ada Lovelace", registered: true },
    ]);
    expect(await owner.query(api.guests.latestImport)).toMatchObject({
      uploadedBy: "owner@example.com",
    });
  });
});

describe("download", () => {
  test("admins get the file as a named attachment", async () => {
    const { as, participantId, addSubmission } = await setup();
    const a = await addSubmission(participantId, { title: "Rocket Keychain" });
    const res = await as.fetch(`/download?id=${a}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="KC-001_ada-lovelace_red_rocket-keychain.stl"'
    );
    expect(await res.text()).toBe("solid model-1");
  });

  test("staff can approve, print, fail or finish jobs, and download files", async () => {
    const { as, participantId, otherId, addSubmission } = await setup();
    const failed = await addSubmission(participantId);
    const done = await addSubmission(otherId);
    await as.mutation(api.queue.approve, { id: failed });
    await as.mutation(api.queue.startPrinting, { id: failed });
    await as.mutation(api.queue.printFailed, { id: failed, reason: "Detached from the bed" });
    await as.mutation(api.queue.approve, { id: done });
    await as.mutation(api.queue.startPrinting, { id: done });
    await as.mutation(api.queue.markDone, { id: done });

    expect((await as.fetch(`/download?id=${done}`)).status).toBe(200);
  });

  test("anonymous and non-admin callers are forbidden", async () => {
    const { t, participantId, addSubmission } = await setup();
    const a = await addSubmission(participantId);
    expect((await t.fetch(`/download?id=${a}`)).status).toBe(403);
    expect((await t.withIdentity(guest).fetch(`/download?id=${a}`)).status).toBe(403);
  });

  test("missing or unknown ids", async () => {
    const { as } = await setup();
    expect((await as.fetch("/download")).status).toBe(400);
    expect((await as.fetch("/download?id=nope")).status).toBe(404);
  });
});

describe("exportRows", () => {
  test("staff can read it, non-admins cannot", async () => {
    const { t, as, participantId, addSubmission } = await setup();
    await addSubmission(participantId);
    expect(await as.query(api.queue.exportRows)).toHaveLength(1);
    await expect(t.query(api.queue.exportRows)).rejects.toThrow();
    await expect(t.withIdentity(guest).query(api.queue.exportRows)).rejects.toThrow();
  });

  test("rows are sorted by printCode with participant details and counts", async () => {
    const { t, as, participantId, otherId, addSubmission } = await setup();
    const b = await addSubmission(otherId, { title: "Second" });
    const a = await addSubmission(participantId, { title: "First" });
    await t.run(async (ctx) => {
      await ctx.db.patch(b, { printCode: "KC-010", printer: "Creality" });
      await ctx.db.patch(a, { printCode: "KC-002" });
      await ctx.db.insert("likes", {
        participantId: otherId,
        submissionId: a,
        reaction: "like",
        updatedAt: 1,
      });
      await ctx.db.insert("likes", {
        participantId: participantId,
        submissionId: a,
        reaction: "skip",
        updatedAt: 2,
      });
      await ctx.db.insert("votes", { voterId: otherId, submissionId: a });
    });

    const rows = await as.query(api.queue.exportRows);
    expect(rows.map((r) => r.printCode)).toEqual(["KC-002", "KC-010"]);
    expect(rows[0]).toMatchObject({
      id: a,
      title: "First",
      username: "Ada L.",
      name: "Ada Lovelace",
      email: "ada@example.com",
      colour: "Red",
      status: "submitted",
      printRequested: true,
      likes: 1,
      votes: 1,
      rejectionReason: "",
    });
    expect(rows[1]).toMatchObject({ printer: "Creality", likes: 0, votes: 0 });

    const info = await as.query(internal.queue.downloadInfo, { id: a });
    expect(rows[0].downloadName).toBe(info?.fileName);
    for (const row of rows) {
      expect(row).not.toHaveProperty("storageId");
      expect(row).not.toHaveProperty("fileUrl");
    }
  });
});
