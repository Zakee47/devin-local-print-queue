import { describe, expect, it } from "vitest";
import { TOURS } from "../lib/tutorials";

describe("tutorial slide copy", () => {
  for (const [tour, slides] of Object.entries(TOURS)) {
    it(`${tour} tour has complete, uniquely illustrated slides`, () => {
      expect(slides.length).toBeGreaterThanOrEqual(5);
      expect(slides.length).toBeLessThanOrEqual(9);
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

  it("shows the complete staff workflow in the approved order", () => {
    expect(TOURS.staff.map(({ art, title, body }) => [art, title, body])).toEqual([
      ["queue", "The print queue", "Prints move through the tabs: Needs review → Queued → Printing → Done, with Rejected on its own tab. All shows every stage at once."],
      ["review", "Approve or reject", "Check the badge first: No print yet, or Already printed with their earlier print code. Approve sends a print to the back of the queue. When you reject, write a clear comment: the participant sees it and can upload a fixed file."],
      ["filters", "Filters and load", "Filter by colour and printer, and tap several to combine them. Watch the load strip for a printer with a backlog."],
      ["colour", "Assign printers", "Each queued card lists printers with that colour loaded first. Or tick several cards and choose Assign to one printer, or Spread evenly to share them across printers with the right colour. Show all printers lets you override the colour match."],
      ["printing", "On the printer", "Press Start printing. When it comes off, mark it done, or mark the print failed with a reason. Use the arrows to reorder the queue, and Move back to undo a step."],
      ["download", "Download files", "Files are named with the print code, name, colour and title, like KC-007_ada-lovelace_red_rocket.3mf, so they sort by print code."],
      ["changed", "Changed by participants", "Watch this list for replaced or withdrawn prints. They leave the queue, and a replaced print needs approving again."],
      ["settings", "Settings and blasts", "In Settings, pause a printer when it's down, untick a colour when it runs out, and set each colour's exact shade. Use the blast message to tell everyone something on every page."],
      ["tv", "TV mode and help", "Open TV from the nav for the big screen. Tap the i button at the top any time to replay this tour."],
    ]);
  });
});
