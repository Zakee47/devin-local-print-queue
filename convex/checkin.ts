import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireOwner } from "./admins";
import { parseLumaCheckIn } from "../lib/luma-qr";

type NewScan = {
  raw: string;
  eventId?: string;
  key?: string;
  status:
    | "pending"
    | "processing"
    | "checked_in"
    | "already_checked_in"
    | "invalid"
    | "wrong_event"
    | "not_found"
    | "error";
  scannedBy: string;
  attempts: number;
  claimedAt?: number;
  finishedAt?: number;
  guestName?: string;
  guestEmail?: string;
  inGuestList?: boolean;
  message?: string;
};

const workerCompletionStatus = v.union(
  v.literal("checked_in"),
  v.literal("already_checked_in"),
  v.literal("not_found"),
  v.literal("error")
);

function requireWorkerSecret(secret: string) {
  const expected = process.env.CHECKIN_WORKER_SECRET;
  if (!expected || secret !== expected) throw new ConvexError("Invalid check-in worker secret");
}

async function recordScan(
  ctx: MutationCtx,
  actor: string,
  scan: NewScan
) {
  const id = await ctx.db.insert("checkinScans", scan);
  await ctx.db.insert("auditLog", { actor, action: "checkin.scan", detail: String(id) });
  return id;
}

export const submitScan = mutation({
  args: { raw: v.string() },
  handler: async (ctx, { raw }) => {
    const actor = await requireOwner(ctx);
    const parsed = parseLumaCheckIn(raw);
    if (!parsed) {
      return await recordScan(ctx, actor, {
        raw,
        status: "invalid",
        scannedBy: actor,
        attempts: 0,
        message: "Not a Luma ticket QR",
        finishedAt: Date.now(),
      });
    }

    if (process.env.LUMA_EVENT_ID && parsed.eventId !== process.env.LUMA_EVENT_ID) {
      return await recordScan(ctx, actor, {
        raw,
        eventId: parsed.eventId,
        key: parsed.key,
        status: "wrong_event",
        scannedBy: actor,
        attempts: 0,
        message: "This ticket is for a different event",
        finishedAt: Date.now(),
      });
    }

    const matchingScans = await ctx.db
      .query("checkinScans")
      .withIndex("by_key", (q) => q.eq("key", parsed.key))
      .collect();
    const active = matchingScans.find(
      (scan) => scan.status === "pending" || scan.status === "processing"
    );
    if (active) return active._id;

    const completed = matchingScans.find(
      (scan) => scan.status === "checked_in" || scan.status === "already_checked_in"
    );
    if (completed) {
      const scannedAt = completed.finishedAt ?? completed._creationTime;
      return await recordScan(ctx, actor, {
        raw,
        eventId: parsed.eventId,
        key: parsed.key,
        status: "already_checked_in",
        scannedBy: actor,
        attempts: 0,
        finishedAt: Date.now(),
        guestName: completed.guestName,
        guestEmail: completed.guestEmail,
        inGuestList: completed.inGuestList,
        message: `Already scanned at ${new Date(scannedAt).toLocaleString("en-GB")}`,
      });
    }

    return await recordScan(ctx, actor, {
      raw,
      eventId: parsed.eventId,
      key: parsed.key,
      status: "pending",
      scannedBy: actor,
      attempts: 0,
    });
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const [scans, workers] = await Promise.all([
      ctx.db.query("checkinScans").order("desc").take(20),
      ctx.db.query("checkinWorker").take(1),
    ]);
    const worker = workers[0];
    return {
      scans,
      workerOnline: Boolean(worker && Date.now() - worker.lastSeen <= 30_000),
      lumaSession: worker?.lumaSession ?? "expired",
    };
  },
});

export const workerHeartbeat = mutation({
  args: { secret: v.string(), lumaSession: v.union(v.literal("ok"), v.literal("expired")) },
  handler: async (ctx, { secret, lumaSession }) => {
    requireWorkerSecret(secret);
    const existing = await ctx.db.query("checkinWorker").first();
    const heartbeat = { lastSeen: Date.now(), lumaSession };
    if (existing) await ctx.db.patch(existing._id, heartbeat);
    else await ctx.db.insert("checkinWorker", heartbeat);
  },
});

export const workerClaim = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireWorkerSecret(secret);
    const now = Date.now();
    const [pending, processing] = await Promise.all([
      ctx.db.query("checkinScans").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
      ctx.db
        .query("checkinScans")
        .withIndex("by_status", (q) => q.eq("status", "processing"))
        .collect(),
    ]);
    const available = [...pending, ...processing]
      .filter((scan) => scan.status === "pending" || !scan.claimedAt || scan.claimedAt <= now - 60_000)
      .sort((a, b) => a._creationTime - b._creationTime)[0];
    if (!available) return null;

    await ctx.db.patch(available._id, {
      status: "processing",
      claimedAt: now,
      attempts: available.attempts + 1,
    });
    if (!available.eventId || !available.key) return null;
    return { _id: available._id, eventId: available.eventId, key: available.key };
  },
});

export const workerComplete = mutation({
  args: {
    secret: v.string(),
    scanId: v.id("checkinScans"),
    status: workerCompletionStatus,
    guestName: v.optional(v.string()),
    guestEmail: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerSecret(args.secret);
    const scan = await ctx.db.get(args.scanId);
    if (!scan) throw new ConvexError("Check-in scan not found");
    const guestEmail = args.guestEmail?.trim().toLowerCase();
    const guest = guestEmail
      ? await ctx.db
          .query("guests")
          .withIndex("by_email", (q) => q.eq("email", guestEmail))
          .unique()
      : null;
    if (guest && guestEmail) await ctx.db.patch(guest._id, { checkedIn: true });
    await ctx.db.patch(args.scanId, {
      status: args.status,
      finishedAt: Date.now(),
      claimedAt: undefined,
      guestName: args.guestName,
      guestEmail,
      ...(guestEmail ? { inGuestList: Boolean(guest) } : {}),
      message: args.message,
    });
    await ctx.db.insert("auditLog", {
      actor: "luma-worker",
      action: "checkin.luma",
      detail: `${guestEmail ?? "unknown email"} ${args.status}`,
    });
  },
});

export const workerRelease = mutation({
  args: { secret: v.string(), scanId: v.id("checkinScans"), message: v.string() },
  handler: async (ctx, { secret, scanId, message }) => {
    requireWorkerSecret(secret);
    const scan = await ctx.db.get(scanId);
    if (!scan) throw new ConvexError("Check-in scan not found");
    await ctx.db.patch(scanId, { status: "pending", claimedAt: undefined, message });
  },
});
