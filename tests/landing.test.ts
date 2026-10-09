import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ABOUT_PHOTOS,
  COLLAGE,
  LONDON_EVENT_HREF,
  NAV_ITEMS,
  SLOTS_DESKTOP,
  SLOTS_MOBILE,
  type Slot,
} from "@/components/landing/data";
import { SOCIAL_POSTS } from "@/components/landing/social-posts";
import { EVENT_HOME } from "@/lib/event";

const pub = (p: string) => join(process.cwd(), "public", p);

describe("landing page data", () => {
  it("ships every collage photo and has unique desktop and mobile slots", () => {
    expect(COLLAGE).toHaveLength(36);
    expect(new Set(COLLAGE).size).toBe(COLLAGE.length);
    expect(SLOTS_DESKTOP).toHaveLength(COLLAGE.length);
    expect(SLOTS_MOBILE).toHaveLength(18);
    for (const slots of [SLOTS_DESKTOP, SLOTS_MOBILE]) {
      expect(new Set(slots.map(([x, y]) => `${x},${y}`)).size).toBe(slots.length);
    }
    for (const id of COLLAGE) expect(existsSync(pub(`landing/collage/${id}-600.webp`))).toBe(true);
  });

  it("keeps desktop and mobile slots from overlapping at all required widths", () => {
    const cases: { width: number; height: number; slots: Slot[]; mobile: boolean }[] = [
      { width: 1440, height: 1800, slots: SLOTS_DESKTOP, mobile: false },
      { width: 1920, height: 1800, slots: SLOTS_DESKTOP, mobile: false },
      { width: 375, height: 1300, slots: SLOTS_MOBILE, mobile: true },
      { width: 414, height: 1300, slots: SLOTS_MOBILE, mobile: true },
    ];
    for (const { width, height, slots, mobile } of cases) {
      for (let i = 0; i < slots.length; i += 1) {
        for (let j = i + 1; j < slots.length; j += 1) {
          const a = slots[i];
          const b = slots[j];
          const aWidth = mobile ? 140 : a[3];
          const bWidth = mobile ? 140 : b[3];
          const aLeft = (a[0] * width) / 100;
          const bLeft = (b[0] * width) / 100;
          if (aLeft >= bLeft + bWidth || bLeft >= aLeft + aWidth) continue;
          const aHeight = (aWidth * 2) / 3;
          const bHeight = (bWidth * 2) / 3;
          for (let step = 0; step <= 100; step += 1) {
            const progress = step / 100;
            const aTop = (a[1] * height) / 100 + a[2] * 200 * (1 - 2 * progress);
            const bTop = (b[1] * height) / 100 + b[2] * 200 * (1 - 2 * progress);
            expect(
              aTop < bTop + bHeight && aTop + aHeight > bTop,
              `slots ${i + 1} and ${j + 1} overlap at ${width}px, p=${progress}`,
            ).toBe(false);
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

  it("points 'Enter the event' at the event app route", () => {
    expect(LONDON_EVENT_HREF).toBe(EVENT_HOME);
    expect(existsSync(join(process.cwd(), "app", EVENT_HOME.slice(1), "page.tsx"))).toBe(true);
    for (const item of NAV_ITEMS) expect(item.href).toMatch(/^#/);
  });
});
