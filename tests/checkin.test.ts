import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const previousOwnerEmail = process.env.OWNER_EMAIL;
const previousEventId = process.env.LUMA_EVENT_ID;
const previousWorkerSecret = process.env.CHECKIN_WORKER_SECRET;
const owner = { subject: "owner-user", email: "owner@example.com", emailVerified: true };
const stranger = { subject: "stranger-user", email: "other@example.com", emailVerified: true };
const raw = "https://luma.com/check-in/evt-test?pk=g-alice";

beforeEach(() => {
  process.env.OWNER_EMAIL = "owner@example.com";
  process.env.CHECKIN_WORKER_SECRET = "worker-secret";
  delete process.env.LUMA_EVENT_ID;
});

afterEach(() => {
  if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = previousOwnerEmail;
  if (previousEventId === undefined) delete process.env.LUMA_EVENT_ID;
  else process.env.LUMA_EVENT_ID = previousEventId;
  if (previousWorkerSecret === undefined) delete process.env.CHECKIN_WORKER_SECRET;
  else process.env.CHECKIN_WORKER_SECRET = previousWorkerSecret;
});

async function setup() {
  const t = convexTest(schema, modules);
  return { t, asOwner: t.withIdentity(owner), asStranger: t.withIdentity(stranger) };
}

describe("check-in scans", () => {
  test("records invalid QR input with an audit row", async () => {
    const { t, asOwner } = await setup();
    const id = await asOwner.mutation(api.checkin.submitScan, { raw: "not a QR" });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      raw: "not a QR",
      status: "invalid",
      message: "Not a Luma ticket QR",
    });
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toMatchObject([
      { action: "checkin.scan" },
    ]);
  });

  test("rejects scans for a different configured event", async () => {
    process.env.LUMA_EVENT_ID = "evt-expected";
    const { t, asOwner } = await setup();
    const id = await asOwner.mutation(api.checkin.submitScan, { raw });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      eventId: "evt-test",
      status: "wrong_event",
    });
  });

  test("deduplicates pending scans and records repeats after completion", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T18:00:00Z"));
    try {
      const { t, asOwner } = await setup();
      const id = await asOwner.mutation(api.checkin.submitScan, { raw });
      expect(await asOwner.mutation(api.checkin.submitScan, { raw })).toBe(id);
      await asOwner.mutation(api.checkin.workerComplete, {
        secret: "worker-secret",
        scanId: id,
        status: "checked_in",
        guestName: "Alice",
        guestEmail: "ALICE@example.com",
      });
      vi.setSystemTime(new Date("2026-10-01T18:00:30Z"));
      const repeated = await asOwner.mutation(api.checkin.submitScan, { raw });
      expect(repeated).not.toBe(id);
      expect(await t.run((ctx) => ctx.db.get(repeated))).toMatchObject({
        status: "already_checked_in",
        guestName: "Alice",
        guestEmail: "alice@example.com",
        message: expect.stringContaining("Already scanned at"),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("deduplicates a recent scan with any status for 30 seconds", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-10-01T18:00:00Z");
    vi.setSystemTime(start);
    try {
      const { t, asOwner } = await setup();
      const id = await asOwner.mutation(api.checkin.submitScan, { raw });
      await asOwner.mutation(api.checkin.workerComplete, {
        secret: "worker-secret",
        scanId: id,
        status: "not_found",
      });

      vi.setSystemTime(new Date(start.getTime() + 29_999));
      expect(await asOwner.mutation(api.checkin.submitScan, { raw })).toBe(id);
      expect(await t.run((ctx) => ctx.db.query("checkinScans").collect())).toHaveLength(1);

      vi.setSystemTime(new Date(start.getTime() + 30_000));
      const retry = await asOwner.mutation(api.checkin.submitScan, { raw });
      expect(retry).not.toBe(id);
      expect(await t.run((ctx) => ctx.db.get(retry))).toMatchObject({ status: "pending" });
    } finally {
      vi.useRealTimers();
    }
  });

  test("claims oldest scans and reclaims stale processing leases", async () => {
    const { t, asOwner } = await setup();
    const first = await asOwner.mutation(api.checkin.submitScan, { raw });
    const claim = await asOwner.mutation(api.checkin.workerClaim, { secret: "worker-secret" });
    expect(claim).toMatchObject({ _id: first, eventId: "evt-test", key: "g-alice" });
    expect(await asOwner.mutation(api.checkin.workerClaim, { secret: "worker-secret" })).toBeNull();
    await t.run((ctx) => ctx.db.patch(first, { claimedAt: Date.now() - 61_000 }));
    expect(await asOwner.mutation(api.checkin.workerClaim, { secret: "worker-secret" })).toMatchObject({
      _id: first,
    });
    expect(await t.run((ctx) => ctx.db.get(first))).toMatchObject({ attempts: 2 });
  });

  test("completes scans, updates known guests, and leaves unknown guests unlisted", async () => {
    const { t, asOwner } = await setup();
    const knownGuestId = await t.run((ctx) =>
      ctx.db.insert("guests", { email: "alice@example.com", checkedIn: false })
    );
    const id = await asOwner.mutation(api.checkin.submitScan, { raw });
    await asOwner.mutation(api.checkin.workerComplete, {
      secret: "worker-secret",
      scanId: id,
      status: "checked_in",
      guestName: "Alice Example",
      guestEmail: "ALICE@example.com",
    });
    expect(await t.run((ctx) => ctx.db.get(knownGuestId))).toMatchObject({ checkedIn: true });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      status: "checked_in",
      inGuestList: true,
    });

    const unknown = await asOwner.mutation(api.checkin.submitScan, {
      raw: "https://luma.com/check-in/evt-test?pk=g-unknown",
    });
    await asOwner.mutation(api.checkin.workerComplete, {
      secret: "worker-secret",
      scanId: unknown,
      status: "checked_in",
      guestEmail: "unknown@example.com",
    });
    expect(await t.run((ctx) => ctx.db.get(unknown))).toMatchObject({ inGuestList: false });
    expect(await t.run((ctx) => ctx.db.query("guests").collect())).toHaveLength(1);
    expect(
      await t.run(async (ctx) =>
        (await ctx.db.query("auditLog").collect()).filter((row) => row.action === "checkin.luma")
      )
    ).toMatchObject([
      { actor: "luma-worker", action: "checkin.luma", detail: "alice@example.com checked_in" },
      { actor: "luma-worker", action: "checkin.luma", detail: "unknown@example.com checked_in" },
    ]);
  });

  test("rejects absent and incorrect worker secrets", async () => {
    const { asOwner } = await setup();
    await expect(
      asOwner.mutation(api.checkin.workerHeartbeat, { secret: "", lumaSession: "ok" })
    ).rejects.toThrow("Invalid check-in worker secret");
    delete process.env.CHECKIN_WORKER_SECRET;
    await expect(
      asOwner.mutation(api.checkin.workerHeartbeat, { secret: "worker-secret", lumaSession: "ok" })
    ).rejects.toThrow("Invalid check-in worker secret");
  });

  test("releases a claimed scan back to pending", async () => {
    const { t, asOwner } = await setup();
    const id = await asOwner.mutation(api.checkin.submitScan, { raw });
    await asOwner.mutation(api.checkin.workerClaim, { secret: "worker-secret" });
    await asOwner.mutation(api.checkin.workerRelease, {
      secret: "worker-secret",
      scanId: id,
      message: "Luma login required",
    });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      status: "pending",
      message: "Luma login required",
    });
  });

  test("owner-only scan operations reject other identities", async () => {
    const { t, asOwner, asStranger } = await setup();
    await expect(asStranger.mutation(api.checkin.submitScan, { raw })).rejects.toThrow("Owner only");
    await expect(asStranger.query(api.checkin.recent, {})).rejects.toThrow("Owner only");
    await expect(t.mutation(api.checkin.submitScan, { raw })).rejects.toThrow("Owner only");
    await asOwner.mutation(api.checkin.workerHeartbeat, { secret: "worker-secret", lumaSession: "ok" });
  });
});
