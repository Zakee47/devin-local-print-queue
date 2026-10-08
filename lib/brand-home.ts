import { EVENT_HOME, EVENT_HOMES } from "@/lib/event";

function normalise(pathname: string | null) {
  return pathname?.replace(/\/+$/, "") || "/";
}

export function eventHomeFor(pathname: string | null): string {
  const path = normalise(pathname);
  return EVENT_HOMES.find((home) => path === home || path.startsWith(`${home}/`)) ?? EVENT_HOME;
}

export function brandHomeHref(pathname: string | null) {
  return EVENT_HOMES.includes(normalise(pathname)) ? "/" : eventHomeFor(pathname);
}
