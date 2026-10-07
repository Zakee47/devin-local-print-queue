import { describe, expect, it } from "vitest";
import { TOURS } from "../lib/tutorials";

describe("tutorial slide copy", () => {
  for (const [tour, slides] of Object.entries(TOURS)) {
    it(`${tour} tour has complete, uniquely illustrated slides`, () => {
      expect(slides.length).toBeGreaterThanOrEqual(5);
      expect(slides.length).toBeLessThanOrEqual(6);
      for (const slide of slides) {
        expect(slide.title.trim()).not.toBe("");
        expect(slide.body.trim()).not.toBe("");
      }
      expect(new Set(slides.map(({ art }) => art)).size).toBe(slides.length);
    });
  }
});
