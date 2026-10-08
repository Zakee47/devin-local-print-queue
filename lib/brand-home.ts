import { EVENT_HOME } from "@/lib/event";

export function brandHomeHref(pathname: string | null) {
  return pathname?.replace(/\/+$/, "") === EVENT_HOME ? "/" : EVENT_HOME;
}
