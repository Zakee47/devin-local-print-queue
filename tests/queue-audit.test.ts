import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { DEFAULT_SETTINGS } from "../convex/settings";
import schema from "../convex/schema";
import { bucketOf } from "../components/admin/queue-view";

const modules = import.meta.glob("../convex/**/*.ts");
const owner = { subject: "owner-user", email: "owner@example.com", emailVerified: true };
const staff = { subject: "staff-user", email: "staff@example.com", emailVerified: true };
const staff2 = { subject: "staff2-user", email: "staff2@example.com", emailVerified: true };
const ada = { subject: "ada-user", email: "ada@example.com", emailVerified: true };
const grace = { subject: "grace-user", email: "grace@example.com", emailVerified: true };
const previousOwnerEmail = process.env.OWNER_EMAIL;

beforeEach(() => {
  process.env.OWNER_EMAIL = owner.email;
});
afterEach(() => {
  if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = previousOwnerEmail;
});

type Status = Doc<"submissions">["status"];

async function setup(settings: Partial<Doc<"settings">> = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("admins", { email: staff.email, role: "staff" });
    await ctx.db.insert("admins", { email: staff2.email, role: "staff" });
    await ctx.db.insert("settings", {
      ...DEFAULT_SETTINGS,
      submissionsOpen: true,
      colours: ["Red", "Blue", "Gold"],
      printers: [
        { name: "Bambu", colours: ["Red", "Blue"] },
        { name: "Prusa", colours: ["Red"] },
        { name: "Ender", colours: ["Gold"] },
      ],
      ...settings,
    });
    const adaId = await ctx.db.insert("participants", {
      clerkUserId: ada.subject,
      email: ada.email,
      name: "Ada Lovelace",
      displayName: "ada",
    });
    const graceId = await ctx.db.insert("participants", {
      clerkUserId: grace.subject,
      email: grace.email,
      name: "Grace Hopper",
      displayName: "grace",
    });
    return { adaId, graceId };
  });
  let n = 0;
  const add = (
    participantId: Id<"participants">,
    opts: Partial<Doc<"submissions">> & { status?: Status } = {}
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
        title: `Keychain ${n}`,
        colour: "Red",
        printRequested: true,
        designEntry: true,
        status: "submitted",
        printCode: `KC-${String(n).padStart(3, "0")}`,
        ...opts,
      });
    });
  const get = (id: Id<"submissions">) => t.run((ctx) => ctx.db.get(id));
  const boardRow = async (id: Id<"submissions">) =>
    (await t.withIdentity(owner).query(api.queue.board, {})).find((row) => row._id === id);
  const audits = (action?: string) =>
    t.run((ctx) => ctx.db.query("auditLog").collect()).then((rows) =>
      action ? rows.filter((row) => row.action === action) : rows
    );
  return {
    t,
    ...ids,
    add,
    get,
    boardRow,
    audits,
    asOwner: t.withIdentity(owner),
    asStaff: t.withIdentity(staff),
    asStaff2: t.withIdentity(staff2),
    asAda: t.withIdentity(ada),
    asGrace: t.withIdentity(grace),
  };
}

describe("withdrawn notice when a print request comes back", () => {
  test("queued Both → Vote → Both returns to Needs review, not Withdrawn", async () => {
    const { add, adaId, asAda, asStaff, boardRow, get } = await setup();
    const id = await add(adaId);
    await asStaff.mutation(api.queue.approve, { id });

    await asAda.mutation(api.submissions.setRoles, { id, role: "vote" });
    expect(bucketOf((await boardRow(id))!)).toBe("withdrawn");

    await asAda.mutation(api.submissions.setRoles, { id, role: "both" });
    const row = (await boardRow(id))!;
    expect(row).toMatchObject({ status: "submitted", printRequested: true });
    expect(row.participantNotice).toBeUndefined();
    expect(row.restorePrint).toBeNull();
    expect(bucketOf(row)).toBe("review");
    expect(await asStaff.query(api.queue.counts, {})).toMatchObject({ review: 1 });

    await asStaff.mutation(api.queue.approve, { id });
    expect((await get(id))?.status).toBe("queued");
  });

  test("deleting the print file promotes Print to a withdrawn/approved sibling as a fresh request", async () => {
    const { add, adaId, asAda, asStaff, boardRow, get } = await setup();
    const voteOnly = await add(adaId, { printRequested: false });
    const printOnly = await add(adaId, { designEntry: false });
    await asStaff.mutation(api.queue.approveForVoting, { id: voteOnly });
    await asAda.mutation(api.submissions.remove, { id: printOnly });

    expect(await get(voteOnly)).toMatchObject({ printRequested: true, designEntry: true });
    expect((await get(voteOnly))?.votingApprovedAt).toBeUndefined();
    expect(bucketOf((await boardRow(voteOnly))!)).toBe("review");
  });

  test("owner restoring a deleted, previously queued print clears its withdrawn notice", async () => {
    const { add, adaId, asAda, asOwner, asStaff, boardRow } = await setup();
    const id = await add(adaId);
    await asStaff.mutation(api.queue.approve, { id });
    await asAda.mutation(api.submissions.remove, { id });

    await asOwner.mutation(api.history.restoreSubmission, { id });
    const row = (await boardRow(id))!;
    expect(row.printRequested).toBe(true);
    expect(bucketOf(row)).toBe("review");
  });
});

describe("queue order", () => {
  test("moving a printing job back never duplicates a queue position", async () => {
    const { add, adaId, graceId, asStaff, get, t } = await setup();
    const a = await add(adaId);
    await asStaff.mutation(api.queue.approve, { id: a });
    await asStaff.mutation(api.queue.startPrinting, { id: a });
    const b = await add(graceId);
    await asStaff.mutation(api.queue.approve, { id: b });
    expect((await get(b))?.queueOrder).toBeGreaterThan((await get(a))!.queueOrder!);

    await asStaff.mutation(api.queue.moveBack, { id: a });
    const queued = await t.run((ctx) =>
      ctx.db.query("submissions").withIndex("by_status_queueOrder", (q) => q.eq("status", "queued")).collect()
    );
    const orders = queued.map((row) => row.queueOrder);
    expect(new Set(orders).size).toBe(orders.length);
    // It goes back to the slot it left, ahead of the job approved while it printed.
    expect(queued.map((row) => row._id)).toEqual([a, b]);
    const positions = await Promise.all(
      [ada, grace].map((who) => t.withIdentity(who).query(api.submissions.mine, {}))
    );
    expect(positions.map((rows) => rows?.[0]?.queuePosition)).toEqual([1, 2]);
  });

  test("move skips a neighbour that started printing and is a no-op at the ends", async () => {
    const { add, adaId, graceId, asStaff, asStaff2, get, audits } = await setup();
    const a = await add(adaId);
    const b = await add(graceId);
    await asStaff.mutation(api.queue.approve, { id: a });
    await asStaff.mutation(api.queue.approve, { id: b });
    await asStaff2.mutation(api.queue.startPrinting, { id: a });

    await asStaff.mutation(api.queue.move, { id: b, direction: "up" });
    expect((await get(a))?.status).toBe("printing");
    expect((await get(b))?.queueOrder).toBe(2);
    expect(await audits("queue.move")).toHaveLength(0);
    await expect(asStaff.mutation(api.queue.move, { id: a, direction: "down" })).rejects.toThrow(
      /printing, expected queued/
    );
  });
});

describe("status transitions", () => {
  test("rejects transitions from the wrong stage", async () => {
    const { add, adaId, graceId, asStaff, asStaff2 } = await setup();
    const queued = await add(adaId, { status: "queued", queueOrder: 1 });
    const rejected = await add(graceId, { status: "rejected", printRequested: false });
    await expect(asStaff.mutation(api.queue.markDone, { id: queued })).rejects.toThrow(/expected printing/);
    await expect(asStaff.mutation(api.queue.startPrinting, { id: rejected })).rejects.toThrow(/expected queued/);
    await expect(asStaff.mutation(api.queue.approve, { id: queued })).rejects.toThrow(/expected submitted/);
    await expect(asStaff.mutation(api.queue.setPrinter, { id: rejected, printer: "Bambu" })).rejects.toThrow();
    await expect(asStaff.mutation(api.queue.printFailed, { id: queued, reason: "x" })).rejects.toThrow();

    await asStaff.mutation(api.queue.startPrinting, { id: queued });
    // A second staff member acting on the same job sees a clear error.
    await expect(asStaff2.mutation(api.queue.startPrinting, { id: queued })).rejects.toThrow(/is printing/);
    await expect(asStaff2.mutation(api.queue.reject, { id: queued, reason: "x" })).rejects.toThrow();
    await asStaff.mutation(api.queue.markDone, { id: queued });
    await expect(asStaff2.mutation(api.queue.markDone, { id: queued })).rejects.toThrow(/is done/);
  });

  test("deleted rows are refused by every admin action", async () => {
    const { add, adaId, asStaff } = await setup();
    const id = await add(adaId, { deletedAt: Date.now() });
    for (const call of [
      () => asStaff.mutation(api.queue.approve, { id }),
      () => asStaff.mutation(api.queue.approveForVoting, { id }),
      () => asStaff.mutation(api.queue.reject, { id, reason: "x" }),
      () => asStaff.mutation(api.queue.moveBack, { id }),
      () => asStaff.mutation(api.queue.restorePrintRequest, { id }),
      () => asStaff.mutation(api.queue.removeFromCompetition, { id }),
    ]) {
      await expect(call()).rejects.toThrow(/deleted by the participant/);
    }
    expect((await asStaff.query(api.queue.board, {})).map((row) => row._id)).not.toContain(id);
  });
});

describe("stale printer assignments", () => {
  test("a job that leaves the queue drops its planned printer", async () => {
    const { add, adaId, graceId, asStaff, get } = await setup();
    const rejected = await add(adaId);
    await asStaff.mutation(api.queue.approve, { id: rejected });
    await asStaff.mutation(api.queue.setPrinter, { id: rejected, printer: "Bambu" });
    await asStaff.mutation(api.queue.reject, { id: rejected, reason: "Too thin" });
    expect((await get(rejected))?.printer).toBeUndefined();

    const back = await add(graceId);
    await asStaff.mutation(api.queue.approve, { id: back });
    await asStaff.mutation(api.queue.setPrinter, { id: back, printer: "Prusa" });
    await asStaff.mutation(api.queue.moveBack, { id: back });
    expect((await get(back))?.printer).toBeUndefined();
  });

  test("re-approving after a failed print starts unassigned instead of on the paused printer", async () => {
    const { add, adaId, asStaff, get } = await setup();
    const id = await add(adaId);
    await asStaff.mutation(api.queue.approve, { id });
    await asStaff.mutation(api.queue.startPrinting, { id, printer: "Bambu" });
    await asStaff.mutation(api.queue.printFailed, { id, reason: "Spaghetti" });
    expect((await get(id))?.printer).toBe("Bambu");
    await asStaff.mutation(api.settings.update, {
      printers: [
        { name: "Bambu", colours: ["Red"], outOfService: true },
        { name: "Prusa", colours: ["Red"] },
      ],
    });
    await asStaff.mutation(api.queue.moveBack, { id });
    await asStaff.mutation(api.queue.approve, { id });
    expect((await get(id))?.printer).toBeUndefined();
    await asStaff.mutation(api.queue.startPrinting, { id });
    expect((await get(id))?.status).toBe("printing");
  });
});

describe("printer rename and removal", () => {
  test("renaming a printer moves its queued and printing jobs with it", async () => {
    const { add, adaId, graceId, asStaff, get, audits } = await setup();
    const queued = await add(adaId, { status: "queued", queueOrder: 1, printer: "Bambu" });
    const printing = await add(graceId, { status: "printing", printer: "bambu " });
    await asStaff.mutation(api.settings.update, {
      printers: [
        { name: "Bambu X1", colours: ["Red", "Blue"] },
        { name: "Prusa", colours: ["Red"] },
        { name: "Ender", colours: ["Gold"] },
      ],
    });
    expect((await get(queued))?.printer).toBe("Bambu X1");
    expect((await get(printing))?.printer).toBe("Bambu X1");
    expect((await audits("queue.setPrinter")).map((row) => row.detail)).toEqual(
      expect.arrayContaining(["Bambu X1 (renamed from Bambu)"])
    );
    await asStaff.mutation(api.queue.startPrinting, { id: queued });
    expect((await get(queued))?.printer).toBe("Bambu X1");
  });

  test("a case-only rename keeps every assignment working", async () => {
    const { add, adaId, asStaff, get } = await setup();
    const queued = await add(adaId, { status: "queued", queueOrder: 1, printer: "Bambu" });
    await asStaff.mutation(api.settings.update, {
      printers: [
        { name: "BAMBU", colours: ["Red"] },
        { name: "Prusa", colours: ["Red"] },
        { name: "Ender", colours: ["Gold"] },
      ],
    });
    await asStaff.mutation(api.queue.startPrinting, { id: queued });
    expect((await get(queued))?.printer).toBe("BAMBU");
  });

  test("removing a printer unassigns its queued jobs; printing and done keep the record", async () => {
    const { add, adaId, graceId, asStaff, get, boardRow, audits } = await setup();
    const queued = await add(adaId, { status: "queued", queueOrder: 1, printer: "Prusa" });
    const printing = await add(graceId, { status: "printing", printer: "Prusa" });
    await asStaff.mutation(api.settings.update, {
      printers: [
        { name: "Bambu", colours: ["Red", "Blue"] },
        { name: "Ender", colours: ["Gold"] },
      ],
    });
    expect((await get(queued))?.printer).toBeUndefined();
    expect((await get(printing))?.printer).toBe("Prusa");
    expect((await boardRow(queued))?.printer).toBeUndefined();
    expect((await audits("queue.setPrinter")).map((row) => row.detail)).toContain(
      "cleared (Prusa removed)"
    );
    await asStaff.mutation(api.queue.startPrinting, { id: queued });
    expect((await get(queued))?.status).toBe("printing");
  });
});

describe("paused printers", () => {
  test("can't receive new work through any path, but an existing assignment stays visible", async () => {
    const { add, adaId, graceId, asStaff, boardRow } = await setup({
      printers: [
        { name: "Bambu", colours: ["Red"], outOfService: true },
        { name: "Prusa", colours: ["Red"] },
      ],
    });
    const assigned = await add(adaId, { status: "queued", queueOrder: 1, printer: "Bambu" });
    const fresh = await add(graceId, { status: "queued", queueOrder: 2 });
    await expect(asStaff.mutation(api.queue.setPrinter, { id: fresh, printer: " bambu " })).rejects.toThrow(/paused/);
    await expect(
      asStaff.mutation(api.queue.assignPrinters, { ids: [fresh], printers: ["Bambu"], mode: "one" })
    ).rejects.toThrow(/paused/);
    await expect(
      asStaff.mutation(api.queue.assignPrinters, { ids: [fresh], printers: ["Bambu", "Prusa"], mode: "spread" })
    ).rejects.toThrow(/paused/);
    await expect(asStaff.mutation(api.queue.startPrinting, { id: fresh, printer: "Bambu" })).rejects.toThrow(/paused/);
    await expect(asStaff.mutation(api.queue.startPrinting, { id: assigned })).rejects.toThrow(/paused/);
    // Re-saving the unchanged assignment is allowed (the card's dropdown).
    await asStaff.mutation(api.queue.setPrinter, { id: assigned, printer: "Bambu" });
    const row = (await boardRow(assigned))!;
    expect(row.printerOutOfService).toBe(true);
    expect(row.printerOptions).not.toContain("Bambu");
  });
});

describe("assignPrinters spread", () => {
  test("keeps queue order, balances load, matches colours across case and whitespace, and reports skips", async () => {
    const { add, adaId, graceId, asStaff, t } = await setup();
    const third = await t.run((ctx) =>
      ctx.db.insert("participants", { clerkUserId: "c", email: "c@example.com", name: "C", displayName: "c" })
    );
    const busy = await add(third, { status: "printing", printer: "Bambu" });
    void busy;
    const j1 = await add(adaId, { status: "queued", queueOrder: 3, colour: " red " });
    const j2 = await add(graceId, { status: "queued", queueOrder: 1, colour: "RED" });
    const j3 = await add(third, { status: "queued", queueOrder: 2, colour: "Gold" });
    const result = await asStaff.mutation(api.queue.assignPrinters, {
      ids: [j1, j2, j3],
      printers: ["Bambu", "prusa", "Prusa"],
      mode: "spread",
    });
    // j2 (#1) → Prusa (Bambu already has a print), j1 (#3) → Bambu (tie, first chosen).
    expect(result.assigned.map(({ id, printer }) => [id, printer])).toEqual([
      [j2, "Prusa"],
      [j1, "Bambu"],
    ]);
    expect(result.skipped.map(({ id }) => id)).toEqual([j3]);
  });
});

describe("settings validation", () => {
  test("dedupes palette colours case-insensitively, like printer colours", async () => {
    const { asStaff, asOwner } = await setup();
    await asStaff.mutation(api.settings.update, { colours: ["Red", " red ", "RED", "Blue"] });
    expect((await asOwner.query(api.settings.get, {})).colours).toEqual(["Red", "Blue"]);
  });

  test("rejects non-positive file and size limits", async () => {
    const { asStaff } = await setup();
    await expect(asStaff.mutation(api.settings.update, { maxFileBytes: 0 })).rejects.toThrow(/file size/i);
    await expect(
      asStaff.mutation(api.settings.update, { maxDimensionsMm: { x: 60, y: -1, z: 45 } })
    ).rejects.toThrow(/size limit/i);
  });

  test("colour codes need exact hex and drop names that left the palette", async () => {
    const { asStaff, asOwner } = await setup();
    await expect(
      asStaff.mutation(api.settings.update, { colourCodes: [{ name: "Red", hex: "red" }] })
    ).rejects.toThrow(/6-digit hex/);
    await asStaff.mutation(api.settings.update, {
      colourCodes: [
        { name: " red ", hex: "#B3152F" },
        { name: "Pink", hex: "#ff00ff" },
      ],
    });
    expect((await asOwner.query(api.settings.get, {})).colourCodes).toEqual([{ name: "red", hex: "#b3152f" }]);
    await asStaff.mutation(api.settings.update, { colours: ["Blue", "Gold"] });
    expect((await asOwner.query(api.settings.get, {})).colourCodes).toEqual([]);
  });

  test("removing a colour that jobs request leaves them unplaceable but still counted", async () => {
    const { add, adaId, asStaff, boardRow } = await setup();
    const id = await add(adaId, { status: "queued", queueOrder: 1, colour: "Gold" });
    await asStaff.mutation(api.settings.update, {
      colours: ["Red", "Blue"],
      printers: [{ name: "Bambu", colours: ["Red", "Blue"] }],
    });
    expect((await boardRow(id))?.printersWithColour).toEqual([]);
    const result = await asStaff.mutation(api.queue.assignPrinters, { ids: [id], printers: ["Bambu"], mode: "spread" });
    expect(result.skipped.map((row) => row.id)).toEqual([id]);
    expect(await asStaff.query(api.submissions.colourDemand, {})).toEqual([{ colour: "Gold", waiting: 1 }]);
  });
});

describe("already printed tracking", () => {
  test("follows failed, withdrawn, restored and finished prints", async () => {
    const { add, adaId, asAda, asStaff, boardRow } = await setup();
    const first = await add(adaId);
    const printOf = async () => (await boardRow(first))?.participantPrint ?? null;

    await asStaff.mutation(api.queue.approve, { id: first });
    expect(await printOf()).toMatchObject({ status: "queued" });
    await asAda.mutation(api.submissions.setRoles, { id: first, role: "vote" });
    expect(await printOf()).toBeNull();
    await asStaff.mutation(api.queue.restorePrintRequest, { id: first });
    expect(await printOf()).toBeNull();
    await asStaff.mutation(api.queue.approve, { id: first });
    await asStaff.mutation(api.queue.startPrinting, { id: first });
    await asStaff.mutation(api.queue.printFailed, { id: first, reason: "Warped" });
    expect(await printOf()).toBeNull();

    const fixed = await add(adaId, { designEntry: false });
    await asStaff.mutation(api.queue.approve, { id: fixed });
    await asStaff.mutation(api.queue.startPrinting, { id: fixed });
    await asStaff.mutation(api.queue.markDone, { id: fixed });
    expect(await printOf()).toMatchObject({ status: "done", printCode: (await boardRow(fixed))?.printCode });
  });
});

describe("vote-only designs approved for voting are Done", () => {
  test("show as Done to staff and participant, stay in voting, and never count as printed", async () => {
    const { add, adaId, graceId, asAda, asStaff, asGrace, boardRow, t } = await setup({ votingOpen: true });
    const id = await add(adaId, { printRequested: false });
    await asStaff.mutation(api.queue.approveForVoting, { id });

    const row = (await boardRow(id))!;
    expect(bucketOf(row)).toBe("done");
    expect(row.participantPrint).toBeNull();
    expect(await asStaff.query(api.queue.counts, {})).toMatchObject({ review: 0, done: 1 });

    const mine = (await asAda.query(api.submissions.mine, {}))!;
    expect(mine[0]).toMatchObject({ status: "submitted", votingApproved: true, print: false });

    const tv = await t.query(api.tv.board, {});
    if (tv.mode !== "queue") throw new Error("expected the queue view");
    expect(tv.upNext).toHaveLength(0);
    expect(tv.recentDone).toHaveLength(0);
    expect(tv.counts).toMatchObject({ queued: 0, printing: 0, done: 0 });

    const gallery = await asGrace.query(api.votes.gallery, {});
    expect(gallery.map((entry) => entry._id)).toContain(id);
    await asGrace.mutation(api.votes.cast, { submissionId: id });

    // A separate print by the same participant is still a first print.
    const print = await add(adaId, { designEntry: false });
    expect((await boardRow(print))?.participantPrint).toBeNull();
    void graceId;
  });

  test("legacy rows that are submitted with votingApprovedAt read as Done everywhere", async () => {
    const { add, adaId, asAda, asStaff, boardRow } = await setup();
    const id = await add(adaId, { printRequested: false, votingApprovedAt: 1000 });
    expect(bucketOf((await boardRow(id))!)).toBe("done");
    expect(await asStaff.query(api.queue.counts, {})).toMatchObject({ review: 0, done: 1 });
    expect((await asAda.query(api.submissions.mine, {}))![0]).toMatchObject({ votingApproved: true });
    await asStaff.mutation(api.queue.moveBack, { id });
    expect(bucketOf((await boardRow(id))!)).toBe("review");
  });

  test("switching a Done vote-only design to Both makes a normal print request", async () => {
    const { add, adaId, asAda, asStaff, boardRow, get } = await setup();
    const id = await add(adaId, { printRequested: false });
    await asStaff.mutation(api.queue.approveForVoting, { id });
    await asAda.mutation(api.submissions.setRoles, { id, role: "both" });

    const row = (await boardRow(id))!;
    expect(bucketOf(row)).toBe("review");
    expect((await asAda.query(api.submissions.mine, {}))![0]).toMatchObject({ votingApproved: false, print: true });
    await asStaff.mutation(api.queue.approve, { id });
    expect(await get(id)).toMatchObject({ status: "queued", printRequested: true, designEntry: true });
  });

  test("approval for voting is refused once the row has a print request or left review", async () => {
    const { add, adaId, graceId, asStaff } = await setup();
    const both = await add(adaId);
    const done = await add(graceId, { status: "done" });
    await expect(asStaff.mutation(api.queue.approveForVoting, { id: both })).rejects.toThrow(/vote-only/);
    await expect(asStaff.mutation(api.queue.approveForVoting, { id: done })).rejects.toThrow(/expected submitted/);
  });

  test("colour demand doesn't count designs that are already Done", async () => {
    const { add, adaId, graceId, asStaff } = await setup();
    const id = await add(adaId, { printRequested: false, colour: "Gold" });
    await add(graceId, { printRequested: false, colour: "Gold" });
    await asStaff.mutation(api.queue.approveForVoting, { id });
    expect(await asStaff.query(api.submissions.colourDemand, {})).toEqual([{ colour: "Gold", waiting: 1 }]);
  });
});

describe("auth", () => {
  test("unverified, non-admin and anonymous callers can't run admin actions", async () => {
    const { add, adaId, t } = await setup();
    const id = await add(adaId);
    const unverifiedStaff = t.withIdentity({ ...staff, emailVerified: false });
    await expect(unverifiedStaff.mutation(api.queue.approve, { id })).rejects.toThrow(/Not authenticated/);
    await expect(t.withIdentity(ada).mutation(api.queue.approve, { id })).rejects.toThrow(/Not an admin/);
    await expect(t.mutation(api.queue.approve, { id })).rejects.toThrow(/Not authenticated/);
    await expect(t.withIdentity(ada).query(api.queue.board, {})).rejects.toThrow(/Not an admin/);
    await expect(t.withIdentity(ada).mutation(api.settings.update, { submissionsOpen: false })).rejects.toThrow();
  });

  test("owner-only actions refuse staff", async () => {
    const { add, adaId, asStaff, asAda } = await setup();
    const id = await add(adaId);
    await asAda.mutation(api.submissions.remove, { id });
    await expect(asStaff.mutation(api.history.restoreSubmission, { id })).rejects.toThrow(/Owner only/);
    await expect(asStaff.mutation(api.settings.update, { votingOpen: true })).rejects.toThrow(/Owner only/);
    await expect(
      asStaff.mutation(api.accounts.deleteParticipant, { participantId: adaId, block: false })
    ).rejects.toThrow(/Owner only/);
    await expect(asStaff.query(api.history.deletedSubmissions, {})).rejects.toThrow(/Owner only/);
  });

  test("a signed-in non-guest can't register or upload", async () => {
    const { t } = await setup();
    const stranger = t.withIdentity({ subject: "x", email: "x@example.com", emailVerified: true });
    await expect(stranger.mutation(api.participants.register, { username: "stranger" })).rejects.toThrow();
    await expect(stranger.mutation(api.submissions.generateUploadUrl, {})).rejects.toThrow(/Not registered/);
  });

  test("participants can't act on another participant's upload", async () => {
    const { add, adaId, asGrace } = await setup();
    const id = await add(adaId);
    await expect(asGrace.mutation(api.submissions.setRoles, { id, role: "vote" })).rejects.toThrow(/not found/);
    await expect(asGrace.mutation(api.submissions.remove, { id })).rejects.toThrow(/not found/);
  });
});

describe("audit log coverage", () => {
  test("every admin queue mutation writes an audit row", async () => {
    const { add, adaId, graceId, asStaff, audits } = await setup();
    const a = await add(adaId);
    const b = await add(graceId, { printRequested: false });
    await asStaff.mutation(api.queue.approve, { id: a });
    await asStaff.mutation(api.queue.setPrinter, { id: a, printer: "Bambu" });
    await asStaff.mutation(api.queue.assignPrinters, { ids: [a], printers: ["Prusa"], mode: "one" });
    await asStaff.mutation(api.queue.startPrinting, { id: a });
    await asStaff.mutation(api.queue.markDone, { id: a });
    await asStaff.mutation(api.queue.moveBack, { id: a });
    await asStaff.mutation(api.queue.printFailed, { id: a, reason: "Failed" });
    await asStaff.mutation(api.queue.approveForVoting, { id: b });
    await asStaff.mutation(api.queue.moveBack, { id: b });
    await asStaff.mutation(api.queue.reject, { id: b, reason: "No" });
    await asStaff.mutation(api.queue.removeFromCompetition, { id: b });
    await asStaff.mutation(api.queue.restoreToCompetition, { id: b });
    const actions = new Set((await audits()).filter((row) => row.actor === staff.email).map((row) => row.action));
    for (const action of [
      "queue.approve",
      "queue.setPrinter",
      "queue.startPrinting",
      "queue.markDone",
      "queue.moveBack",
      "queue.printFailed",
      "queue.approveForVoting",
      "queue.reject",
      "competition.remove",
      "competition.restore",
    ]) {
      expect(actions).toContain(action);
    }
  });
});
