export const EVENT_NAME = "Devin Local: London";
export const EVENT_URL = "https://luma.com/wn0h6ffm";
export const CHALLENGE = "Design a keychain";

// Up to 2 uploads; exactly one is the participant's entry for printing and voting.
export const MAX_SUBMISSIONS_PER_PARTICIPANT = 2;
export const MAX_VOTES_PER_PARTICIPANT = 2;
export const MAX_BLAST_MESSAGE_LENGTH = 280;
export const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ["stl", "3mf"] as const;
export const DEFAULT_COLOURS = ["Black", "White", "Silver", "Gold", "Sea Green", "Sky Blue"];
export const COLOUR_DISCLAIMER = "Colour requests depend on which printer is free and aren't guaranteed.";

export type Printer = { name: string; colours: string[] };
export const DEFAULT_PRINTERS: Printer[] = [
  { name: "Creality", colours: [...DEFAULT_COLOURS] },
  { name: "Ultimaker", colours: [...DEFAULT_COLOURS] },
  { name: "Muon 1", colours: [...DEFAULT_COLOURS] },
  { name: "Muon 2", colours: [...DEFAULT_COLOURS] },
];

export type Dimensions = { x: number; y: number; z: number };
export const DEFAULT_MAX_DIMENSIONS_MM: Dimensions = { x: 60, y: 60, z: 45 };

export function submissionsAreOpen(
  s: { submissionsOpen: boolean; submissionsDeadline?: number },
  now: number
): boolean {
  return s.submissionsOpen && (s.submissionsDeadline === undefined || now < s.submissionsDeadline);
}

export type SubmissionStatus = "submitted" | "rejected" | "queued" | "printing" | "done";

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: "Awaiting review",
  rejected: "Rejected",
  queued: "Queued",
  printing: "Printing",
  done: "Done",
};

// Votes can change freely while voting is open; closing voting locks them.
export const VOTES_ARE_FINAL = false;
// Likes/skips are allowed on any done entry. Set true to only allow them while
// settings.votingOpen.
export const LIKES_REQUIRE_VOTING_OPEN = false;
export type Reaction = "like" | "skip";
