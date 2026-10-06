export type Tour = "participant" | "staff";

export type TutorialArt =
  | "upload"
  | "roles"
  | "journey"
  | "voting"
  | "changes"
  | "help"
  | "queue"
  | "download"
  | "review"
  | "printing"
  | "changed"
  | "tv";

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
      art: "journey",
      title: "Your print's journey",
      body: "Needs approval → Queued → Printing → Done. Your page and the TV update live as staff move it along.",
    },
    {
      art: "voting",
      title: "Votes pick the winner, hearts break ties",
      body: "Your 2 votes are your real picks for who wins the 3D printer, and you can't vote for your own. A heart just means \"I like this\" and only counts to break ties.",
    },
    {
      art: "changes",
      title: "Changed your mind?",
      body: "While submissions are open and before printing starts, you can swap roles, replace a file or delete it. A replacement keeps its print code, but its votes reset.",
    },
    {
      art: "help",
      title: "Help is always here",
      body: "Press the ? button at the top of the page to replay this tour.",
    },
  ],
  staff: [
    {
      art: "queue",
      title: "The print queue",
      body: "Prints move through the tabs: Needs review → Queued → Printing → Done. Rejected files have their own tab.",
    },
    {
      art: "download",
      title: "Download files",
      body: "Files are named with the print code, name, colour and title, like KC-007_ada-lovelace_red_rocket.3mf, so they sort in queue order.",
    },
    {
      art: "review",
      title: "Approve or reject",
      body: "Approve sends a print to the queue. When you reject, write a clear comment: the participant sees it and can upload a fixed file.",
    },
    {
      art: "printing",
      title: "On the printer",
      body: "Pick a printer and press Start printing. When it comes off, mark it done, or mark the print failed with a reason.",
    },
    {
      art: "changed",
      title: "Changed by participants",
      body: "Watch this list for replaced or withdrawn prints. They leave the queue, and a replaced print needs approving again.",
    },
    {
      art: "tv",
      title: "TV mode and help",
      body: "Open TV from the nav for the big screen. Press ? any time to replay this tour.",
    },
  ],
};
