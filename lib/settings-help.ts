// Copy for the "?" help pop-ups next to each admin setting. Keep it in plain
// English and in line with what the code actually does.

export type SettingHelpState = { label: string; text: string };

export type SettingHelpCopy = {
  title: string;
  what: string;
  on: SettingHelpState;
  off: SettingHelpState;
  note?: string;
};

export const SETTINGS_HELP = {
  submissionIntake: {
    title: "Submission intake",
    what: "Whether participants can add or change their uploads on /submit.",
    on: {
      label: "Open:",
      text: "Participants can upload new files, replace or delete theirs, switch between Vote, Print and Both, and edit the title, notes and colour.",
    },
    off: {
      label: "Closed:",
      text: "Everything on /submit is read-only. The site banner and the TV say submissions are closed (\"not open yet\" on the site if they've never been opened).",
    },
    note: "A deadline that has passed keeps submissions closed even while this says Open. Staff can still approve and print either way, and someone whose print failed can still upload a fixed file to print.",
  },
  deadline: {
    title: "Deadline",
    what: "An optional time when submissions close by themselves.",
    on: {
      label: "When set:",
      text: "While submissions are open, the site banner and the TV count down to it. At that time uploads, replacements, deletes and edits stop, even though the toggle above still says Open.",
    },
    off: {
      label: "When cleared:",
      text: "No countdown. Submissions stay open or closed by the toggle above alone.",
    },
    note: "+15 min, +30 min and +1 h add time to the current deadline, or count from now if it has passed or there isn't one. A new future deadline reopens submissions if the toggle is still Open. \"Close now\" switches the toggle to Closed and leaves the deadline as it is.",
  },
  blast: {
    title: "Blast message",
    what: "A short message from the organisers, up to 280 characters.",
    on: {
      label: "When sent:",
      text: "It shows in a banner at the top of the site and on the TV. Anyone with the site open also gets a \"New message from the organisers\" pop-up.",
    },
    off: {
      label: "When cleared:",
      text: "The banner disappears from the site and the TV.",
    },
    note: "The pop-up only appears when the words change, so sending the same text again doesn't notify anyone. Sending an empty message clears it. The Settings page and the Print queue page edit the same message.",
  },
  printers: {
    title: "Printers",
    what: "The printers staff can assign prints to on the queue, including whether each printer is paused.",
    on: {
      label: "Added:",
      text: "Staff can pick it for a print on the queue and tick its loaded colours. Pause it when it is down.",
    },
    off: {
      label: "Removed:",
      text: "It's no longer offered on the queue. Participants see colour availability and waiting counts, never printer names.",
    },
    note: "Prints already given a printer keep that name, even if you rename or remove it.",
  },
  loadedColours: {
    title: "Loaded colours",
    what: "Which palette colours are on this printer right now.",
    on: {
      label: "Ticked:",
      text: "Staff see matching in-service printers first on queue cards asking for that colour. Participants see availability and waiting counts, never printer names.",
    },
    off: {
      label: "Unticked:",
      text: "This printer isn't suggested for that colour. If no in-service printer has it, participants see that it's unavailable but can still ask for it.",
    },
    note: "Colour requests are not guaranteed. This is only a hint for participants and staff.",
  },
  maxDimensions: {
    title: "Max dimensions",
    what: "The largest model allowed, in millimetres.",
    on: {
      label: "Too big:",
      text: "New uploads and replacements are refused, with the model's size and the limit shown. A model counts as fitting if it fits when turned any way.",
    },
    off: {
      label: "Fits:",
      text: "The upload goes through as normal.",
    },
    note: "Files already uploaded aren't checked again when you change this.",
  },
  maxFileSize: {
    title: "Max file size",
    what: "The largest STL or 3MF file participants can upload, in megabytes.",
    on: {
      label: "Too big:",
      text: "New uploads and replacements are refused as soon as the file is picked, with its size and the limit shown.",
    },
    off: {
      label: "Within the limit:",
      text: "The upload goes through as normal.",
    },
    note: "Files already uploaded aren't checked again when you change this.",
  },
  colourPalette: {
    title: "Colour palette",
    what: "The colours participants can ask for, in the order they're shown on /submit, with optional custom colour codes.",
    on: {
      label: "Added:",
      text: "It appears as a swatch on /submit; add a hex colour code to choose its exact swatch colour.",
    },
    off: {
      label: "Removed:",
      text: "Participants can't pick it any more and it's unticked on every printer. Uploads that already asked for it keep their request.",
    },
    note: "Participants can always choose \"Any\". They see availability and waiting counts, never printer names. Colour requests are not guaranteed.",
  },
  previews: {
    title: "Previews",
    what: "Makes snapshot images for uploads that don't have one, using this browser.",
    on: {
      label: "When run:",
      text: "Each file without a picture is drawn here and saved, so /vote and the TV can show an image instead of loading the 3D model. Keep this tab open until it finishes.",
    },
    off: {
      label: "Without a preview:",
      text: "The design shows a \"Tap to load 3D\" box on /vote and is left out of the TV's Projects collage.",
    },
  },
  staff: {
    title: "Staff",
    what: "People who help run the event from /admin. Only the owner can change this list.",
    on: {
      label: "Added:",
      text: "They sign in with that email and can review and approve uploads, run the print queue, download files and change everything on this page above this section.",
    },
    off: {
      label: "Removed:",
      text: "They lose access to /admin.",
    },
    note: "Staff can't open or close voting, change the TV, or see Guests, Participants, Team or Votes.",
  },
  voting: {
    title: "Voting",
    what: "Whether participants can vote, like and skip on /vote.",
    on: {
      label: "Open:",
      text: "Each participant has 2 votes (never for their own design) and can change them, and can like or skip designs. Leaderboards on the site and the TV show \"Live\".",
    },
    off: {
      label: "Closed:",
      text: "Votes, likes and skips are locked: nobody can cast, change or remove them. /vote is browse-only and leaderboards show \"Voting closed\".",
    },
    note: "Votes and likes belong to the file they were given to. If a participant replaces their file, its votes and likes normally go back to 0. Replacing needs submissions open, so close submissions too if you want to freeze the results.",
  },
  showResultsOnTv: {
    title: "Results on TV",
    what: "Whether the TV's main tab shows the results instead of the print queue.",
    on: {
      label: "Shown:",
      text: "The main tab becomes \"Winner\": the top-voted design in 3D, plus the runners-up ranked by votes. Only designs with at least one vote are listed, and the print queue leaves the TV.",
    },
    off: {
      label: "Hidden:",
      text: "The main tab is \"Print queue\": the live leaderboard next to what's printing now and up next.",
    },
    note: "This only changes the TV, not the website. The winner updates live while voting is still open. The Projects tab is the same either way.",
  },
  tvDefaultView: {
    title: "TV default view",
    what: "Which tab /tv opens on.",
    on: {
      label: "Main tab:",
      text: "The TV shows the print queue, or the winner while results are on the TV.",
    },
    off: {
      label: "Projects:",
      text: "The TV shows the live leaderboard next to a collage of design pictures. Designs without a preview aren't in the collage.",
    },
    note: "Screens showing plain /tv switch straight away. A screen where someone clicked a tab (its address ends in ?view=…) stays on that tab until it's opened at plain /tv again.",
  },
} satisfies Record<string, SettingHelpCopy>;

export type SettingHelpKey = keyof typeof SETTINGS_HELP;
