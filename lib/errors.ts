import { ConvexError } from "convex/values";

const FALLBACK = "Something went wrong";

export function errorMessage(e: unknown, fallback = FALLBACK): string {
  if (e instanceof ConvexError) return typeof e.data === "string" && e.data ? e.data : fallback;
  if (!(e instanceof Error) || !e.message) return fallback;
  const uncaught = e.message.match(/Uncaught \w*Error: (.+)/);
  const message = uncaught
    ? uncaught[1]
    : e.message.replace(/^(\s*\[(?:CONVEX [^\]]*|Request ID: [^\]]*)\])+\s*/, "").split("\n")[0];
  return message.trim() || fallback;
}
