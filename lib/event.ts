export const EVENT_NAME = "Devin Local: London";
export const EVENT_URL = "https://luma.com/wn0h6ffm";
export const CHALLENGE = "Design a keychain";

export const MAX_SUBMISSIONS_PER_PARTICIPANT = 2;
export const MAX_VOTES_PER_PARTICIPANT = 2;
export const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ["stl", "3mf"] as const;
export const DEFAULT_COLOURS = [
  "Black",
  "White",
  "Grey",
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Purple",
];

export type SubmissionStatus = "submitted" | "rejected" | "queued" | "printing" | "done";

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: "Awaiting review",
  rejected: "Rejected",
  queued: "Queued",
  printing: "Printing",
  done: "Done",
};

// Confirmed votes can't be retracted. Flip to false to let people change votes
// while voting is open.
export const VOTES_ARE_FINAL = true;
// Likes/skips are allowed on any done entry. Set true to only allow them while
// settings.votingOpen.
export const LIKES_REQUIRE_VOTING_OPEN = false;
export type Reaction = "like" | "skip";
