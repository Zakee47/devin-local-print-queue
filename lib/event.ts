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
