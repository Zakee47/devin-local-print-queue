import { parseCsv } from "./csv";

export type ParsedGuest = { email: string; name?: string; checkedIn: boolean };

export type ParsedGuestCsv = {
  guests: ParsedGuest[];
  hasCheckInColumn: boolean;
  rowCount: number;
};

const EMAIL_HEADERS = ["email", "email address", "e-mail"];
const NAME_HEADERS = ["name", "full name"];
const FIRST_HEADERS = ["first_name", "first name"];
const LAST_HEADERS = ["last_name", "last name"];
const CHECKIN_HEADERS = ["checked_in_at", "checked in at", "checked_in", "check-in time"];

function findColumn(header: string[], names: string[]) {
  return header.findIndex((h) => names.includes(h.trim().toLowerCase()));
}

// Parses a Luma guest export. When the export has a check-in column, only
// rows with a non-empty value there are eligible; otherwise every row is.
export function parseGuestCsv(text: string): ParsedGuestCsv {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return { guests: [], hasCheckInColumn: false, rowCount: 0 };
  const header = rows[0];
  const emailCol = findColumn(header, EMAIL_HEADERS);
  if (emailCol === -1) throw new Error("CSV has no email column");
  const nameCol = findColumn(header, NAME_HEADERS);
  const firstCol = findColumn(header, FIRST_HEADERS);
  const lastCol = findColumn(header, LAST_HEADERS);
  const checkInCol = findColumn(header, CHECKIN_HEADERS);
  const hasCheckInColumn = checkInCol !== -1;

  const byEmail = new Map<string, ParsedGuest>();
  for (const row of rows.slice(1)) {
    const email = row[emailCol]?.trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const joined = [row[firstCol], row[lastCol]].filter(Boolean).join(" ").trim();
    const name = (nameCol !== -1 ? row[nameCol]?.trim() : "") || joined || undefined;
    const raw = hasCheckInColumn ? row[checkInCol]?.trim().toLowerCase() : "yes";
    const checkedIn = !!raw && raw !== "false" && raw !== "no" && raw !== "0";
    const prev = byEmail.get(email);
    byEmail.set(email, { email, name: name ?? prev?.name, checkedIn: checkedIn || !!prev?.checkedIn });
  }
  return { guests: [...byEmail.values()], hasCheckInColumn, rowCount: rows.length - 1 };
}
