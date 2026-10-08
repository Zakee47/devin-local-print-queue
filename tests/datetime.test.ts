import { expect, it } from "vitest";
import { formatDateTime } from "@/lib/datetime";

it("formats a date with its year and time", () => {
  const formatted = formatDateTime(new Date(2026, 2, 1, 15, 25).getTime());
  expect(formatted).toMatch(/2026/);
  expect(formatted).toMatch(/\d{2}:\d{2}/);
});
