import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { DEFAULT_SETTINGS } from "../convex/settings";
import schema from "../convex/schema";
import { bucketOf } from "../components/admin/queue-view";
import { auditActionLabel } from "../lib/audit";

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

const PRINT_AFTER = "queue.printAfterVotingApproval";

describe("approved for voting only", () => {
  test("approval audits code, username and colour, and never becomes a print", async () => {
    const { add, adaId, asStaff, audits, boardRow, get } = await setup();
    const id = await add(adaId, { printRequested: false, colour: "Sky Blue" });

    await asStaff.mutation(api.queue.approveForVoting, { id });

    const [row] = await audits("queue.approveForVoting");
    expect(row).toMatchObject({ actor: staff.email, submissionId: id, detail: "KC-001 · ada · Sky Blue" });
    expect(auditActionLabel(row.action)).toBe("Approved for voting only");
    expect((await get(id))?.status).toBe("submitted");
    const board = (await boardRow(id))!;
    expect(board.participantPrint).toBeNull();
    expect(bucketOf(board)).toBe("done");
    expect(await audits("queue.markDone")).toHaveLength(0);
  });

  test("Vote-only → Both after approval goes back to review and logs once as the participant", async () => {
    const { add, adaId, asAda, asStaff, audits, boardRow, get } = await setup();
    const id = await add(adaId, { printRequested: false });
    await asStaff.mutation(api.queue.approveForVoting, { id });

    await asAda.mutation(api.submissions.setRoles, { id, role: "both" });

    expect((await get(id))?.votingApprovedAt).toBeUndefined();
    expect(bucketOf((await boardRow(id))!)).toBe("review");
    const logs = await audits(PRINT_AFTER);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actor: ada.email, submissionId: id, detail: "KC-001 · ada · Red" });
    expect(auditActionLabel(PRINT_AFTER)).toBe("Print request added after voting approval");
  });

  test("logs when an approved sibling picks up Print from a role change", async () => {
    const { add, adaId, asAda, asStaff, audits } = await setup();
    const printOnly = await add(adaId, { designEntry: false });
    const voteOnly = await add(adaId, { printRequested: false });
    await asStaff.mutation(api.queue.approveForVoting, { id: voteOnly });

    await asAda.mutation(api.submissions.setRoles, { id: printOnly, role: "vote" });

    expect(await audits(PRINT_AFTER)).toEqual([
      expect.objectContaining({ actor: ada.email, submissionId: voteOnly }),
    ]);
  });

  test("logs when deleting the print file promotes Print to an approved design", async () => {
    const { add, adaId, asAda, asStaff, audits, get } = await setup();
    const voteOnly = await add(adaId, { printRequested: false });
    const printOnly = await add(adaId, { designEntry: false });
    await asStaff.mutation(api.queue.approveForVoting, { id: voteOnly });

    await asAda.mutation(api.submissions.remove, { id: printOnly });

    expect((await get(voteOnly))?.votingApprovedAt).toBeUndefined();
    expect(await audits(PRINT_AFTER)).toEqual([
      expect.objectContaining({ actor: ada.email, submissionId: voteOnly, detail: "KC-001 · ada · Red" }),
    ]);
  });

  test("logs as the owner when a history restore brings Print back to an approved row", async () => {
    const { add, adaId, asOwner, audits, get } = await setup();
    const id = await add(adaId, {
      printRequested: false,
      designEntry: false,
      votingApprovedAt: 1000,
      deletedAt: 2000,
      deletedRoles: { vote: true, print: true },
    });

    await asOwner.mutation(api.history.restoreSubmission, { id });

    expect((await get(id))?.votingApprovedAt).toBeUndefined();
    expect(await audits(PRINT_AFTER)).toEqual([
      expect.objectContaining({ actor: owner.email, submissionId: id }),
    ]);
  });

  test("no log when a never-approved vote-only design gains Print", async () => {
    const { add, adaId, asAda, audits } = await setup();
    const id = await add(adaId, { printRequested: false });

    await asAda.mutation(api.submissions.setRoles, { id, role: "both" });

    expect(await audits(PRINT_AFTER)).toHaveLength(0);
  });

  test("History shows both entries with actor and time", async () => {
    const { add, adaId, asAda, asOwner, asStaff } = await setup();
    const id = await add(adaId, { printRequested: false });
    await asStaff.mutation(api.queue.approveForVoting, { id });
    await asAda.mutation(api.submissions.setRoles, { id, role: "both" });

    const history = await asOwner.query(api.history.forSubmission, { id });
    const entries = history!.audit.filter((row) => row.action === PRINT_AFTER || row.action === "queue.approveForVoting");
    expect(entries.map((row) => [auditActionLabel(row.action), row.actor])).toEqual([
      ["Print request added after voting approval", ada.email],
      ["Approved for voting only", staff.email],
    ]);
    expect(entries.every((row) => typeof row.at === "number")).toBe(true);
  });
});
