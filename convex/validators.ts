import { v } from "convex/values";

// Lifecycle: submitted → (rejected | queued → printing → done).
// Participants see "submitted" as "Awaiting review".
export const submissionStatus = v.union(
  v.literal("submitted"),
  v.literal("rejected"),
  v.literal("queued"),
  v.literal("printing"),
  v.literal("done")
);

export const fileKind = v.union(v.literal("stl"), v.literal("3mf"));
