import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const previousOwnerEmail = process.env.OWNER_EMAIL;
const identities = {
  participant: { subject: "participant-user", email: "participant@example.com", emailVerified: true },
  plain: { subject: "plain-user", email: "plain@example.com", emailVerified: true },
  owner: { subject: "owner-user", email: "owner@example.com", emailVerified: true },
  staff: { subject: "staff-user", email: "staff@example.com", emailVerified: true },
  unverified: { subject: "unverified-user", email: "unverified@example.com", emailVerified: false },
};

beforeEach(() => {
  process.env.OWNER_EMAIL = identities.owner.email;
});

afterEach(() => {
  if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = previousOwnerEmail;
});

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("participants", {
      clerkUserId: identities.participant.subject,
      email: identities.participant.email,
      name: "Participant",
      displayName: "participant",
    });
    await ctx.db.insert("admins", { email: identities.staff.email, role: "staff" });
  });
  return {
    t,
    participant: t.withIdentity(identities.participant),
    plain: t.withIdentity(identities.plain),
    owner: t.withIdentity(identities.owner),
    staff: t.withIdentity(identities.staff),
    unverified: t.withIdentity(identities.unverified),
  };
}

describe("tutorial views", () => {
  it("returns null for signed-out viewers", async () => {
    const { t } = await setup();
    await expect(t.query(api.tutorials.seen, { tour: "participant" })).resolves.toBeNull();
    await expect(t.query(api.tutorials.seen, { tour: "staff" })).resolves.toBeNull();
    await expect(t.mutation(api.tutorials.markSeen, { tour: "participant" })).rejects.toThrow(
      "Not authenticated"
    );
  });

  it("lets registered participants mark the participant tour seen", async () => {
    const { participant } = await setup();
    await expect(participant.query(api.tutorials.seen, { tour: "participant" })).resolves.toBe(false);
    await expect(participant.mutation(api.tutorials.markSeen, { tour: "participant" })).resolves.toBeNull();
    await expect(participant.query(api.tutorials.seen, { tour: "participant" })).resolves.toBe(true);
  });

  it("does not allow participants to mark the staff tour", async () => {
    const { plain } = await setup();
    await expect(plain.query(api.tutorials.seen, { tour: "staff" })).resolves.toBeNull();
    await expect(plain.mutation(api.tutorials.markSeen, { tour: "staff" })).rejects.toThrow("Not an admin");
  });

  it("allows staff and the owner to mark the staff tour", async () => {
    const { staff, owner } = await setup();
    for (const viewer of [staff, owner]) {
      await expect(viewer.query(api.tutorials.seen, { tour: "staff" })).resolves.toBe(false);
      await expect(viewer.mutation(api.tutorials.markSeen, { tour: "staff" })).resolves.toBeNull();
      await expect(viewer.query(api.tutorials.seen, { tour: "staff" })).resolves.toBe(true);
    }
    await expect(owner.query(api.tutorials.seen, { tour: "participant" })).resolves.toBeNull();
    await expect(owner.mutation(api.tutorials.markSeen, { tour: "participant" })).rejects.toThrow("Not registered");
  });

  it("inserts only one row when marking a tour seen repeatedly", async () => {
    const { t, participant } = await setup();
    await participant.mutation(api.tutorials.markSeen, { tour: "participant" });
    await participant.mutation(api.tutorials.markSeen, { tour: "participant" });
    const rows = await t.run((ctx) =>
      ctx.db
        .query("tutorialViews")
        .withIndex("by_email_tour", (q) =>
          q.eq("email", identities.participant.email).eq("tour", "participant")
        )
        .collect()
    );
    expect(rows).toHaveLength(1);
  });

  it("returns null when the viewer's email is unverified", async () => {
    const { unverified } = await setup();
    await expect(unverified.query(api.tutorials.seen, { tour: "participant" })).resolves.toBeNull();
    await expect(unverified.mutation(api.tutorials.markSeen, { tour: "participant" })).rejects.toThrow(
      "Not authenticated"
    );
  });
});
