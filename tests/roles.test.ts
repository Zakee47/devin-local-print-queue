import { describe, expect, test } from "vitest";
import { planRoles, roleOf, rolesOf, type RoleFile } from "../lib/roles";

function file(
  id: string,
  role: "vote" | "print" | "both" | "none",
  extra: Partial<RoleFile> = {}
): RoleFile {
  return {
    id,
    printCode: `KC-${id}`,
    vote: role === "vote" || role === "both",
    print: role === "print" || role === "both",
    status: "submitted",
    designRemoved: false,
    ...extra,
  };
}

describe("roles", () => {
  test("converts roles to booleans and back", () => {
    expect((["vote", "print", "both"] as const).map(rolesOf)).toEqual([
      { vote: true, print: false },
      { vote: false, print: true },
      { vote: true, print: true },
    ]);
    expect(roleOf({ vote: false, print: false })).toBeNull();
    expect(roleOf({ vote: true, print: false })).toBe("vote");
    expect(roleOf({ vote: false, print: true })).toBe("print");
    expect(roleOf({ vote: true, print: true })).toBe("both");
  });

  test("plans role moves and describes them", () => {
    const plan = planRoles([file("011", "both")], null, "vote");
    expect(plan).toEqual({
      ok: true,
      vote: true,
      print: false,
      withdrawsPrint: false,
      others: [{ id: "011", printCode: "KC-011", vote: false, print: true, withdrawsPrint: false }],
      notes: ["Moves Vote from KC-011"],
    });
  });

  test("blocks a move that would leave an active file without a role", () => {
    expect(planRoles([file("011", "vote")], null, "vote")).toEqual({
      ok: false,
      reason: "KC-011 must keep Vote or Print",
    });
  });

  test("allows Vote on a second Print upload but rejects Both", () => {
    const firstUpload = planRoles([file("011", "both")], null, "print");
    expect(firstUpload).toMatchObject({ ok: true, others: [{ vote: true, print: false }] });
    const active = [file("011", "vote"), file("012", "print")];
    expect(planRoles(active, "012", "both")).toEqual({
      ok: false,
      reason: "KC-011 must keep Vote or Print",
    });
  });

  test("notes when moving Print withdraws a queued file", () => {
    const plan = planRoles(
      [file("011", "both", { status: "queued" })],
      "011",
      "vote"
    );
    expect(plan).toMatchObject({
      ok: true,
      vote: true,
      print: false,
      withdrawsPrint: true,
      notes: ["Takes KC-011 out of the print queue"],
    });
  });

  test("notes and withdraws Print moved off another queued file", () => {
    const plan = planRoles(
      [file("011", "both", { status: "queued" }), file("012", "none")],
      "012",
      "print"
    );
    expect(plan).toMatchObject({
      ok: true,
      others: [{ id: "011", vote: true, print: false, withdrawsPrint: true }],
      notes: ["Moves Print from KC-011 and takes it out of the print queue"],
    });
  });

  test.each(["printing", "done"] as const)("locks role changes on %s files", (status) => {
    expect(planRoles([file("011", "both", { status })], "011", "vote")).toEqual({
      ok: false,
      reason: status === "printing"
        ? "KC-011 is printing. Ask staff for changes."
        : "KC-011 has been printed. Ask staff for changes.",
    });
  });

  test("does not let rejected Print or removed Vote roles be selected", () => {
    expect(planRoles([file("011", "vote", { status: "rejected" })], "011", "print")).toEqual({
      ok: false,
      reason: "KC-011's print was rejected. Replace the file to request a print again.",
    });
    expect(planRoles([file("011", "print", { designRemoved: true })], "011", "both")).toEqual({
      ok: false,
      reason: "The organizers removed KC-011 from the competition.",
    });
  });

  test("keeps roleless legacy backups untouched", () => {
    const backup = file("011", "none");
    const plan = planRoles([backup], null, "print");
    expect(plan).toMatchObject({ ok: true, others: [], notes: [] });
  });
});
