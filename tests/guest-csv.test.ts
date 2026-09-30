import { describe, expect, it } from "vitest";
import { parseGuestCsv } from "@/lib/guest-csv";

describe("parseGuestCsv", () => {
  it("only marks rows with a check-in time as eligible", () => {
    const csv = [
      "api_id,name,first_name,last_name,email,approval_status,checked_in_at",
      'g1,"Lovelace, Ada",,,Ada@Example.com,approved,2026-10-01T18:00:00Z',
      "g2,Grace Hopper,,,grace@example.com,approved,",
    ].join("\n");
    const out = parseGuestCsv(csv);
    expect(out.hasCheckInColumn).toBe(true);
    expect(out.guests).toEqual([
      { email: "ada@example.com", name: "Lovelace, Ada", checkedIn: true },
      { email: "grace@example.com", name: "Grace Hopper", checkedIn: false },
    ]);
  });

  it("treats every row as eligible without a check-in column", () => {
    const out = parseGuestCsv("Email,First Name,Last Name\r\nx@y.com,Alan,Turing\r\n");
    expect(out.hasCheckInColumn).toBe(false);
    expect(out.guests).toEqual([{ email: "x@y.com", name: "Alan Turing", checkedIn: true }]);
  });

  it("rejects files without an email column", () => {
    expect(() => parseGuestCsv("name\nAda")).toThrow(/email/);
  });
});
