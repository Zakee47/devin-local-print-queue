export type LumaCheckIn = {
  eventId: string;
  key: string;
  kind: "guest" | "ticket";
};

export function parseLumaCheckIn(raw: string): LumaCheckIn | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    !["luma.com", "www.luma.com", "lu.ma", "www.lu.ma"].includes(host)
  ) {
    return null;
  }

  const match = url.pathname.match(/^\/check-in\/([A-Za-z0-9-]+)$/);
  const key = url.searchParams.get("pk")?.trim();
  if (!match || !key) return null;

  return { eventId: match[1], key, kind: key.startsWith("g-") ? "guest" : "ticket" };
}
