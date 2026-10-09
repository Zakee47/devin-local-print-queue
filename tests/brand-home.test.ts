import { describe, expect, it } from "vitest";
import { brandHomeHref, eventHomeFor } from "@/lib/brand-home";
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

describe("eventHomeFor", () => {
  it("returns the event home for event roots and subpaths", () => {
    expect(eventHomeFor(EVENT_HOME)).toBe(EVENT_HOME);
    expect(eventHomeFor(`${EVENT_HOME}/`)).toBe(EVENT_HOME);
    expect(eventHomeFor(`${EVENT_HOME}/anything`)).toBe(EVENT_HOME);
  });

  it("returns the default event home for shared routes and no context", () => {
    expect(eventHomeFor("/submit")).toBe(EVENT_HOME);
    expect(eventHomeFor("/vote")).toBe(EVENT_HOME);
    expect(eventHomeFor("/")).toBe(EVENT_HOME);
    expect(eventHomeFor(null)).toBe(EVENT_HOME);
  });

  it("does not match a route with a similar event prefix", () => {
    expect(eventHomeFor("/london-010")).toBe(EVENT_HOME);
  });
});
