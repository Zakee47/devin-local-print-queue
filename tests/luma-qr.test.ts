import { describe, expect, test } from "vitest";
import { parseLumaCheckIn } from "../lib/luma-qr";

describe("parseLumaCheckIn", () => {
  test("parses guest and ticket keys", () => {
    expect(parseLumaCheckIn(" https://luma.com/check-in/evt-123?pk=g-abc ")).toEqual({
      eventId: "evt-123",
      key: "g-abc",
      kind: "guest",
    });
    expect(parseLumaCheckIn("https://luma.com/check-in/evt-123?pk=t9x7k2")).toEqual({
      eventId: "evt-123",
      key: "t9x7k2",
      kind: "ticket",
    });
  });

  test.each([
    "https://www.luma.com/check-in/evt-123?pk=g-abc",
    "https://lu.ma/check-in/evt-123?pk=g-abc",
    "https://www.lu.ma/check-in/evt-123?pk=g-abc",
  ])("accepts legacy/WWW host %s", (raw) => {
    expect(parseLumaCheckIn(raw)?.key).toBe("g-abc");
  });

  test.each([
    "garbage",
    "http://luma.com/check-in/evt-123?pk=g-abc",
    "https://evil.example/check-in/evt-123?pk=g-abc",
    "https://luma.com/check-in/evt-123",
    "https://luma.com/check-in/evt-123?pk=",
    "https://luma.com/other/evt-123?pk=g-abc",
    "https://luma.com/check-in/a/b?pk=g-abc",
  ])("rejects invalid QR %s", (raw) => {
    expect(parseLumaCheckIn(raw)).toBeNull();
  });
});
