import { convexTest } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const previousOwnerEmail = process.env.OWNER_EMAIL;

afterEach(() => {
  if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = previousOwnerEmail;
});

const owner = { subject: "owner-user", email: "owner@example.com", emailVerified: true };
const staff = { subject: "staff-user", email: "staff@example.com", emailVerified: true };
const stranger = { subject: "stranger-user", email: "ada@example.com", emailVerified: true };

async function setup() {
  process.env.OWNER_EMAIL = "owner@example.com";
  const t = convexTest(schema, modules);
  await t.run((ctx) => ctx.db.insert("admins", { email: staff.email }));
  const importId = await t.run((ctx) =>
    ctx.db.insert("guestImports", {
      fileName: "luma.csv",
      uploadedBy: "owner@example.com",
      rowCount: 2,
      eligibleCount: 2,
      hasCheckInColumn: true,
    })
  );
  return {
    t,
    asOwner: t.withIdentity(owner),
    asStaff: t.withIdentity(staff),
    asStranger: t.withIdentity(stranger),
    importId,
  };
}

const guests = (t: Awaited<ReturnType<typeof setup>>["t"]) =>
  t.run((ctx) => ctx.db.query("guests").collect());
const audit = (t: Awaited<ReturnType<typeof setup>>["t"]) =>
  t.run((ctx) => ctx.db.query("auditLog").collect());

describe("addGuest", () => {
  test("normalises the email and inserts a checked-in manual guest", async () => {
    const { t, asOwner } = await setup();
    await asOwner.mutation(api.guests.addGuest, { email: " Ada@Example.COM ", name: "  Ada  " });
    const [row] = await guests(t);
    expect(row).toMatchObject({
      email: "ada@example.com",
      name: "Ada",
      checkedIn: true,
      manual: true,
    });
    expect(row.importId).toBeUndefined();
    expect((await audit(t)).map((l) => [l.action, l.detail])).toEqual([
      ["guests.add", "ada@example.com"],
    ]);
  });

  test("rejects emails without an @", async () => {
    const { asOwner } = await setup();
    await expect(asOwner.mutation(api.guests.addGuest, { email: "nope" })).rejects.toThrow(
      "Enter a valid email address"
    );
  });

  test("upserts an existing CSV row: manual, checked in, name updated", async () => {
    const { t, asOwner, importId } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("guests", { email: "ada@example.com", checkedIn: false, importId })
    );
    await asOwner.mutation(api.guests.addGuest, { email: "Ada@Example.com", name: "Ada L" });
    const rows = await guests(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: "ada@example.com",
      name: "Ada L",
      checkedIn: true,
      manual: true,
      importId,
    });
  });

  test("is owner-only", async () => {
    const { t, asStaff, asStranger } = await setup();
    for (const user of [t, asStaff, asStranger]) {
      await expect(
        user.mutation(api.guests.addGuest, { email: "x@example.com" })
      ).rejects.toThrow("Owner only");
    }
  });
});

describe("removeGuest", () => {
  test("deletes the row and writes an audit entry", async () => {
    const { t, asOwner } = await setup();
    const id = await asOwner.mutation(api.guests.addGuest, { email: "ada@example.com" });
    await asOwner.mutation(api.guests.removeGuest, { id });
    expect(await guests(t)).toHaveLength(0);
    expect((await audit(t)).map((l) => l.action)).toEqual(["guests.add", "guests.remove"]);
    await expect(asOwner.mutation(api.guests.removeGuest, { id })).rejects.toThrow(
      "Guest not found"
    );
  });

  test("is owner-only", async () => {
    const { t, asOwner, asStaff } = await setup();
    const id = await asOwner.mutation(api.guests.addGuest, { email: "ada@example.com" });
    await expect(asStaff.mutation(api.guests.removeGuest, { id })).rejects.toThrow("Owner only");
    await expect(t.mutation(api.guests.removeGuest, { id })).rejects.toThrow("Owner only");
  });
});

describe("importCsv with manual rows", () => {
  test("keeps manual rows, drops old imported rows, merges matching emails", async () => {
    const { t, asOwner, importId } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("guests", { email: "old@example.com", checkedIn: true, importId });
      await ctx.db.insert("guests", { email: "ada@example.com", name: "Ada", checkedIn: true, importId });
      await ctx.db.insert("guests", { email: "manual@example.com", checkedIn: true, manual: true });
      await ctx.db.insert("guests", {
        email: "named@example.com",
        name: "Manual Name",
        checkedIn: true,
        manual: true,
      });
    });

    await asOwner.mutation(api.guests.importCsv, {
      fileName: "new.csv",
      rowCount: 3,
      hasCheckInColumn: false,
      guests: [
        { email: "fresh@example.com", checkedIn: true },
        { email: "manual@example.com", name: "Csv Name", checkedIn: true },
        { email: "named@example.com", name: "Csv Name", checkedIn: false },
      ],
    });

    const rows = (await guests(t)).sort((a, b) => a.email.localeCompare(b.email));
    expect(rows.map((g) => [g.email, g.manual === true, g.checkedIn, g.name])).toEqual([
      ["fresh@example.com", false, true, undefined],
      ["manual@example.com", true, true, "Csv Name"],
      ["named@example.com", true, true, "Manual Name"],
    ]);
    expect(rows.filter((g) => g.email === "manual@example.com")).toHaveLength(1);
  });
});

describe("registration", () => {
  test("a manually added guest can register", async () => {
    const { t, asOwner } = await setup();
    await asOwner.mutation(api.guests.addGuest, { email: "ada@example.com", name: "Ada Lovelace" });
    const ada = t.withIdentity({ subject: "ada-user", email: "ada@example.com", emailVerified: true });
    const id = await ada.mutation(api.participants.register, { username: "Ada L" });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      email: "ada@example.com",
      name: "Ada Lovelace",
      displayName: "Ada L",
    });
  });
});
