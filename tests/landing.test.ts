import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ABOUT_PHOTOS,
  COLLAGE,
  LONDON_EVENT_HREF,
  COPY_COLUMN_DESKTOP,
  SCATTER_DESKTOP,
  SCATTER_MOBILE,
  NAV_ITEMS,
} from "@/components/landing/data";
import { SOCIAL_POSTS } from "@/components/landing/social-posts";
import { EVENT_HOME } from "@/lib/event";

const pub = (p: string) => join(process.cwd(), "public", p);

describe("landing page data", () => {
  it("ships every collage photo and places all desktop photos once", () => {
    expect(COLLAGE).toHaveLength(35);
    const desktopIds = SCATTER_DESKTOP.map((photo) => photo.id);
    const mobileIds = SCATTER_MOBILE.map((photo) => photo.id);
    expect(desktopIds).toHaveLength(COLLAGE.length);
    expect(new Set(desktopIds).size).toBe(COLLAGE.length);
    expect([...desktopIds].sort()).toEqual([...COLLAGE].sort());
    expect(mobileIds).toHaveLength(18);
    expect(new Set(mobileIds).size).toBe(mobileIds.length);
    expect(mobileIds.every((id) => COLLAGE.slice(0, 18).includes(id))).toBe(true);
    for (const photo of SCATTER_DESKTOP) {
      expect(photo.w).toBeGreaterThanOrEqual(8);
      expect(photo.w).toBeLessThanOrEqual(40);
      expect(photo.x + photo.w <= COPY_COLUMN_DESKTOP.left || photo.x >= COPY_COLUMN_DESKTOP.right).toBe(true);
    }
    for (const photo of SCATTER_MOBILE) {
      expect(photo.w).toBeGreaterThanOrEqual(25);
      expect(photo.w).toBeLessThanOrEqual(60);
      expect(photo.x).toBeGreaterThanOrEqual(0);
      expect(photo.x + photo.w).toBeLessThanOrEqual(100);
    }
    for (const id of COLLAGE) expect(existsSync(pub(`landing/collage/${id}-600.webp`))).toBe(true);
  });

  it("keeps desktop and mobile scatter photos from overlapping through the full motion", () => {
    for (const photos of [SCATTER_DESKTOP, SCATTER_MOBILE]) {
      for (let i = 0; i < photos.length; i += 1) {
        for (let j = i + 1; j < photos.length; j += 1) {
          const a = photos[i];
          const b = photos[j];
          if (a.x >= b.x + b.w || b.x >= a.x + a.w) continue;
          for (let step = 0; step <= 100; step += 1) {
            const progress = step / 100;
            const aTop = a.y + a.range * (1 - 2 * progress);
            const bTop = b.y + b.range * (1 - 2 * progress);
            const aBottom = aTop + (a.w * 2) / 3;
            const bBottom = bTop + (b.w * 2) / 3;
            expect(aTop < bBottom && aBottom > bTop, `${a.id} overlaps ${b.id} at ${progress}`).toBe(false);
          }
        }
      }
    }
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
