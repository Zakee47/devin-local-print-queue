import { describe, expect, it } from "vitest";
import { brandHomeHref } from "@/lib/brand-home";
import { EVENT_HOME } from "@/lib/event";

describe("brandHomeHref", () => {
  it("routes the event page to the global homepage", () => {
    expect(brandHomeHref(EVENT_HOME)).toBe("/");
    expect(brandHomeHref(`${EVENT_HOME}/`)).toBe("/");
  });

  it("routes every other page to the event homepage", () => {
    expect(brandHomeHref("/submit")).toBe(EVENT_HOME);
    expect(brandHomeHref("/")).toBe(EVENT_HOME);
    expect(brandHomeHref(null)).toBe(EVENT_HOME);
  });
});
