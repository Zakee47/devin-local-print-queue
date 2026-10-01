/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const previousOwnerEmail = process.env.OWNER_EMAIL;

afterEach(() => {
  if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = previousOwnerEmail;
  vi.useRealTimers();
});

const identity = {
  subject: "ada",
  email: "ada@example.com",
  emailVerified: true,
};

describe("completePlaybookStep", () => {
  test("rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.participants.completePlaybookStep, {})).rejects.toThrow(
      "Not registered"
    );
  });

  test("rejects signed-in users who are not registered", async () => {
    const t = convexTest(schema, modules);
    const ada = t.withIdentity(identity);
    await expect(ada.mutation(api.participants.completePlaybookStep, {})).rejects.toThrow(
      "Not registered"
    );
  });

  test("updates viewer status and keeps the first completion timestamp", async () => {
    const t = convexTest(schema, modules);
    const ada = t.withIdentity(identity);
    const participantId = await t.run((ctx) =>
      ctx.db.insert("participants", {
        clerkUserId: identity.subject,
        email: identity.email,
        name: "Ada",
        displayName: "Ada",
      })
    );

    expect(await ada.query(api.participants.viewerStatus, {})).toEqual({
      state: "registered",
      email: "ada@example.com",
      displayName: "Ada",
      playbookStepDone: false,
    });

    const firstCompletion = new Date("2026-01-01T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(firstCompletion);
    await ada.mutation(api.participants.completePlaybookStep, {});

    expect(await ada.query(api.participants.viewerStatus, {})).toMatchObject({
      state: "registered",
      playbookStepDone: true,
    });
    const firstRow = await t.run((ctx) => ctx.db.get(participantId));
    expect(firstRow?.playbookStepDoneAt).toBe(firstCompletion.getTime());

    vi.setSystemTime(new Date(firstCompletion.getTime() + 60_000));
    await ada.mutation(api.participants.completePlaybookStep, {});
    const secondRow = await t.run((ctx) => ctx.db.get(participantId));
    expect(secondRow?.playbookStepDoneAt).toBe(firstCompletion.getTime());
  });
});
