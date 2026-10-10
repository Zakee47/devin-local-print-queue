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
      ["queue", "The print queue", "Prints move through the tabs: Needs review → Queued → Printing → Done, with Rejected and Withdrawn on their own tabs. Every stage shows them all, grouped by stage."],
      ["review", "Approve or reject", "Check the badge first: No print yet, or Already printed with their earlier print code. Approve sends a print to the back of the queue, and Approve for voting sends a vote-only design straight to Done. When you reject, write a clear comment: the participant sees it and can upload a fixed file."],
      ["filters", "Filters and load", "Press + Add filter to narrow by colour then printer, or the other way round. Tap × on a pill to drop it. The printer cards at the top show each printer's queue, loaded colours and whether it's paused."],
      ["colour", "Assign printers", "Each queued card lists printers with that colour loaded first, then other printers if you need to override. Or tick several cards and choose Assign to one printer, or Spread evenly to share them across printers with the right colour."],
      ["printing", "On the printer", "Press Start printing. When it comes off, mark it done, or mark the print failed with a reason. Drag a queued card by its handle to reorder the queue, and use Move back to undo a step."],
      ["download", "Download files", "Files are named with the print code, name, colour and title, like KC-007_ada-lovelace_red_rocket.3mf, so they sort by print code."],
      ["changed", "Changed by participants", "Watch this list for replaced or withdrawn prints. Withdrawn prints move to the Withdrawn tab, where Restore print request undoes an accident."],
      ["settings", "Settings and blasts", "In Settings, pause a printer when it's down, untick a colour when it runs out, and set each colour's exact shade. Use the blast message to tell everyone something on every page."],
      ["tv", "TV mode and help", "Open TV from the nav for the big screen. Tap the i button at the top any time to replay this tour."],
    ]);
  });
});
