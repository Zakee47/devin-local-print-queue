import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ABOUT_PHOTOS,
  COLLAGE,
  LONDON_EVENT_HREF,
  LANES_DESKTOP,
  LANES_MOBILE,
  NAV_ITEMS,
} from "@/components/landing/data";
import { SOCIAL_POSTS } from "@/components/landing/social-posts";
import { EVENT_HOME } from "@/lib/event";

const pub = (p: string) => join(process.cwd(), "public", p);

describe("landing page data", () => {
  it("ships every collage photo and assigns each desktop photo to one lane", () => {
    expect(COLLAGE).toHaveLength(35);
    expect(LANES_DESKTOP).toHaveLength(7);
    expect(LANES_MOBILE).toHaveLength(3);
    const desktopIds = LANES_DESKTOP.flatMap((lane) => lane.photos.map((photo) => photo.id));
    const mobileIds = LANES_MOBILE.flatMap((lane) => lane.photos.map((photo) => photo.id));
    expect(desktopIds).toHaveLength(COLLAGE.length);
    expect(new Set(desktopIds).size).toBe(COLLAGE.length);
    expect([...desktopIds].sort()).toEqual([...COLLAGE].sort());
    expect(mobileIds).toHaveLength(18);
    expect(new Set(mobileIds).size).toBe(mobileIds.length);
    expect(mobileIds.every((id) => COLLAGE.slice(0, 18).includes(id))).toBe(true);
    for (const lane of [...LANES_DESKTOP, ...LANES_MOBILE]) {
      expect(lane.photos.length).toBeGreaterThan(0);
      for (const photo of lane.photos) {
        expect(photo.scale).toBeGreaterThanOrEqual(50);
        expect(photo.scale).toBeLessThanOrEqual(100);
      }
    }
    for (const id of COLLAGE) expect(existsSync(pub(`landing/collage/${id}-600.webp`))).toBe(true);
  });

  it("ships both sizes of the four about photos", () => {
    for (const { id } of ABOUT_PHOTOS) {
      expect(existsSync(pub(`landing/about/about-${id}-800.webp`))).toBe(true);
      expect(existsSync(pub(`landing/about/about-${id}-1600.webp`))).toBe(true);
    }
  });

  it("has self-hosted media for every social post", () => {
    expect(SOCIAL_POSTS.length).toBeGreaterThan(0);
    const featured = SOCIAL_POSTS.filter((p) => p.featured);
    expect(featured.length).toBeGreaterThan(0);
    for (const post of SOCIAL_POSTS) {
      expect(post.url).toMatch(/^https:\/\//);
      expect(existsSync(pub(post.author.avatar))).toBe(true);
      for (const m of post.media) {
        expect(existsSync(pub(m.src))).toBe(true);
        if (m.poster) expect(existsSync(pub(m.poster))).toBe(true);
      }
    }
  });

  it("points 'See the event' at the event app route", () => {
    expect(LONDON_EVENT_HREF).toBe(EVENT_HOME);
    expect(existsSync(join(process.cwd(), "app", EVENT_HOME.slice(1), "page.tsx"))).toBe(true);
    for (const item of NAV_ITEMS) expect(item.href).toMatch(/^#/);
  });
});
