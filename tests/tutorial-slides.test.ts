import { describe, expect, it } from "vitest";
import { TOURS } from "../lib/tutorials";

describe("tutorial slide copy", () => {
  for (const [tour, slides] of Object.entries(TOURS)) {
    it(`${tour} tour has complete, uniquely illustrated slides`, () => {
      expect(slides.length).toBeGreaterThanOrEqual(5);
      expect(slides.length).toBeLessThanOrEqual(7);
      for (const slide of slides) {
        expect(slide.title.trim()).not.toBe("");
        expect(slide.body.trim()).not.toBe("");
      }
      expect(new Set(slides.map(({ art }) => art)).size).toBe(slides.length);
    });
  }

  it("places colour guidance after participant roles", () => {
    const slides = TOURS.participant;
    expect(slides[slides.findIndex(({ art }) => art === "roles") + 1]).toMatchObject({
      art: "colour",
      title: "Pick a colour, or Any colour",
      body: "Each colour shows how many prints are waiting for it. Not fussy? Pick Any colour or a quieter shade and you'll print sooner. Colours depend on what's loaded and aren't guaranteed.",
    });
  });

  it("places filter guidance after the staff queue slide", () => {
    const slides = TOURS.staff;
    expect(slides[slides.findIndex(({ art }) => art === "queue") + 1]).toMatchObject({
      art: "filters",
      title: "Filters and printers",
      body: "Use All to see every stage. Filter by colour and printer, watch the load strip for a backlog, and mark a printer out of service in Settings when it's down.",
    });
    expect(slides.find(({ art }) => art === "printing")?.body).toBe(
      "Assign each queued print to a printer, or tick several and bulk assign, then press Start printing. When it comes off, mark it done, or mark the print failed with a reason."
    );
  });
});
