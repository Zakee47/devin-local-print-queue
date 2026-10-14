import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { chromium } from "playwright-core";

// Hypothesis adapter only: calibrate every URL and selector against the real
// logged-in Luma check-in page before adapting this throwaway worker.
const LUMA_ADAPTER = {
  checkInUrl: (baseUrl, eventId, key) =>
    `${baseUrl}/check-in/${encodeURIComponent(eventId)}?pk=${encodeURIComponent(key)}`,
  signInPath: "/signin",
  invalidText: "Not Valid",
  checkedInText: "Checked in",
  notCheckedInText: "Not checked in",
  guestName: "[data-guest-name]",
  guestEmail: "[data-guest-email]",
  ticketStatus: "[data-ticket-status]",
  checkInButton: 'button:has-text("Check In")',
};

const convexUrl = process.env.CONVEX_URL;
const secret = process.env.CHECKIN_WORKER_SECRET;
const baseUrl = (process.env.LUMA_BASE_URL || "http://localhost:4010").replace(/\/+$/, "");
const profileDir = process.env.LUMA_PROFILE_DIR || join(homedir(), ".luma-checkin-spike-profile");
const loginMode = process.argv.includes("--login");

if (!convexUrl || !secret) throw new Error("Set CONVEX_URL and CHECKIN_WORKER_SECRET.");
const hostname = new URL(baseUrl).hostname.toLowerCase();
if (["luma.com", "lu.ma"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
  throw new Error("This spike worker is restricted to a mock Luma host.");
}

await mkdir(profileDir, { recursive: true });
const client = new ConvexHttpClient(convexUrl);
const browser = await chromium.launchPersistentContext(profileDir, {
  executablePath: process.env.CHROME_PATH || "/home/ubuntu/.local/bin/google-chrome",
  headless: !loginMode,
  viewport: { width: 1280, height: 900 },
});
const page = browser.pages()[0] || (await browser.newPage());
let currentSession = "ok";
let stopping = false;

async function heartbeat(lumaSession = currentSession) {
  await client.mutation(api.checkin.workerHeartbeat, { secret, lumaSession });
  currentSession = lumaSession;
}

async function complete(scanId, status, details = {}) {
  await client.mutation(api.checkin.workerComplete, {
    secret,
    scanId,
    status,
    ...details,
  });
}

async function processScan(scan) {
  await page.goto(LUMA_ADAPTER.checkInUrl(baseUrl, scan.eventId, scan.key), {
    waitUntil: "domcontentloaded",
  });
  if (new URL(page.url()).pathname === LUMA_ADAPTER.signInPath) {
    await client.mutation(api.checkin.workerRelease, {
      secret,
      scanId: scan._id,
      message: "Luma session expired; sign in again on the VM",
    });
    await heartbeat("expired");
    return false;
  }
  await heartbeat("ok");

  const body = await page.locator("body").innerText();
  if (body.includes(LUMA_ADAPTER.invalidText)) {
    await complete(scan._id, "not_found", { message: "Ticket key was not found on Luma" });
    return true;
  }

  const guestName = (await page.locator(LUMA_ADAPTER.guestName).textContent())?.trim() || undefined;
  const guestEmail = (await page.locator(LUMA_ADAPTER.guestEmail).textContent())?.trim() || undefined;
  const status = (await page.locator(LUMA_ADAPTER.ticketStatus).textContent())?.trim() || "";
  if (status.includes(LUMA_ADAPTER.checkedInText) && !status.includes(LUMA_ADAPTER.notCheckedInText)) {
    await complete(scan._id, "already_checked_in", { guestName, guestEmail });
    return true;
  }

  await page.locator(LUMA_ADAPTER.checkInButton).click();
  await page.locator(LUMA_ADAPTER.ticketStatus).getByText(LUMA_ADAPTER.checkedInText, { exact: true }).waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await complete(scan._id, "checked_in", { guestName, guestEmail });
  return true;
}

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

console.log(`Luma worker using mock host ${baseUrl}`);
await heartbeat("ok");
const heartbeatTimer = setInterval(() => {
  void heartbeat(currentSession).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
  });
}, 10_000);
if (loginMode) {
  await page.goto(`${baseUrl}${LUMA_ADAPTER.signInPath}`);
  console.log("Sign in to the local mock Luma in this browser; the session is saved in the profile.");
}

while (!stopping) {
  try {
    const scan = await client.mutation(api.checkin.workerClaim, { secret });
    if (scan) {
      try {
        const shouldContinue = await processScan(scan);
        if (!shouldContinue) await delay(10_000);
      } catch (error) {
        await complete(scan._id, "error", {
          message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        });
      }
      await delay(800);
    } else {
      await delay(1_000);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await delay(5_000);
  }
}

clearInterval(heartbeatTimer);
await browser.close();
