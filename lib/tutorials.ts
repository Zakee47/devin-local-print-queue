export type Tour = "participant" | "staff";

export type TutorialArt =
  | "upload"
  | "roles"
  | "colour"
  | "journey"
  | "voting"
  | "changes"
  | "help"
  | "queue"
  | "filters"
  | "download"
  | "review"
  | "printing"
  | "changed"
  | "tv"
  | "settings";

export type TutorialSlide = { art: TutorialArt; title: string; body: string };

export const TOURS: Record<Tour, TutorialSlide[]> = {
  participant: [
    {
      art: "upload",
      title: "Welcome to the keychain challenge",
      body: "Upload up to 2 keychain designs as STL or 3MF files. Each one gets a print code like KC-007.",
    },
    {
      art: "roles",
      title: "Choose Vote, Print or Both",
      body: "Vote enters your design in the competition straight away, and the winner takes home a 3D printer. Print asks staff to print it for you once they approve it. You can have one of each.",
    },
    {
      art: "colour",
      title: "Pick a colour, or Any colour",
      body: "Each colour shows how many prints are waiting for it. Not fussy? Pick Any colour or a quieter shade and you'll print sooner. Colours depend on what's loaded and aren't guaranteed.",
    },
    {
      art: "journey",
      title: "Your print's journey",
      body: "Needs approval → Queued → Printing → Done. Your page and the TV update live as staff move it along.",
    },
    {
      art: "voting",
      title: "Votes pick the winner, likes only break ties",
      body: "Tap Cast vote to use one of your 2 real votes. A VOTED stamp lands when it counts, and you can't vote for your own. Like · tie-breaker just shortlists designs you like and only settles ties.",
    },
    {
      art: "changes",
      title: "Changed your mind?",
      body: "While submissions are open and before printing starts, you can swap roles, replace a file or delete it. A replacement keeps its print code, but its votes reset.",
    },
    {
      art: "help",
      title: "Help is always here",
      body: "Tap the i button at the top of the page to replay this tour.",
    },
  ],
  staff: [
    {
      art: "queue",
      title: "The print queue",
      body: "Prints move through the tabs: Needs review → Queued → Printing → Done, with Rejected on its own tab. All shows every stage at once.",
    },
    {
      art: "review",
      title: "Approve or reject",
      body: "Check the badge first: No print yet, or Already printed with their earlier print code. Approve sends a print to the back of the queue. When you reject, write a clear comment: the participant sees it and can upload a fixed file.",
    },
    {
      art: "filters",
      title: "Filters and load",
      body: "Filter by colour and printer, and tap several to combine them. Watch the load strip for a printer with a backlog.",
    },
    {
      art: "colour",
      title: "Assign printers",
      body: "Each queued card lists printers with that colour loaded first. Or tick several cards and choose Assign to one printer, or Spread evenly to share them across printers with the right colour. Show all printers lets you override the colour match.",
    },
    {
      art: "printing",
      title: "On the printer",
      body: "Press Start printing. When it comes off, mark it done, or mark the print failed with a reason. Use the arrows to reorder the queue, and Move back to undo a step.",
    },
    {
      art: "download",
      title: "Download files",
      body: "Files are named with the print code, name, colour and title, like KC-007_ada-lovelace_red_rocket.3mf, so they sort by print code.",
    },
    {
      art: "changed",
      title: "Changed by participants",
      body: "Watch this list for replaced or withdrawn prints. They leave the queue, and a replaced print needs approving again.",
    },
    {
      art: "settings",
      title: "Settings and blasts",
      body: "In Settings, pause a printer when it's down, untick a colour when it runs out, and set each colour's exact shade. Use the blast message to tell everyone something on every page.",
    },
    {
      art: "tv",
      title: "TV mode and help",
      body: "Open TV from the nav for the big screen. Tap the i button at the top any time to replay this tour.",
    },
  ],
};
