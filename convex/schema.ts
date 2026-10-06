import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { submissionStatus, fileKind } from "./validators";

export default defineSchema({
  // Staff organizers; the owner is configured with OWNER_EMAIL.
  admins: defineTable({
    email: v.string(),
    role: v.optional(v.literal("staff")),
  }).index("by_email", ["email"]),

  blockedEmails: defineTable({
    email: v.string(),
    reason: v.optional(v.string()),
    blockedBy: v.string(),
  }).index("by_email", ["email"]),

  // Eligibility allowlist, replaced by each Luma CSV upload, except manual rows.
  guests: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    checkedIn: v.boolean(),
    importId: v.optional(v.id("guestImports")),
    // Added by hand in the admin UI; survives CSV uploads.
    manual: v.optional(v.boolean()),
  }).index("by_email", ["email"]),

  guestImports: defineTable({
    fileName: v.string(),
    uploadedBy: v.string(),
    rowCount: v.number(),
    eligibleCount: v.number(),
    hasCheckInColumn: v.boolean(),
  }),

  // A verified, checked-in guest who has created an account.
  participants: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
    // Public, participant-chosen username for the TV and gallery.
    displayName: v.string(),
    usernameKey: v.optional(v.string()),
    playbookStepDoneAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_usernameKey", ["usernameKey"]),

  submissions: defineTable({
    participantId: v.id("participants"),
    storageId: v.id("_storage"),
    // Client-rendered snapshot image; shown instead of downloading the model.
    previewStorageId: v.optional(v.id("_storage")),
    originalFileName: v.string(),
    kind: fileKind,
    sizeBytes: v.number(),
    title: v.string(),
    notes: v.optional(v.string()),
    // Requested filament colour; best effort, not guaranteed.
    colour: v.optional(v.string()),
    // At most one active submission per participant has this set.
    printRequested: v.boolean(),
    // The participant's competition entry; no staff approval. Read through
    // isDesignEntry: rows from before this field existed fall back to printRequested.
    designEntry: v.optional(v.boolean()),
    // Staff pulled this design from the competition; printing is unaffected.
    designRemoved: v.optional(v.boolean()),
    designRemovedReason: v.optional(v.string()),
    designRemovedAt: v.optional(v.number()),
    status: submissionStatus,
    // Human-friendly sequential code, e.g. "KC-007", assigned on creation.
    printCode: v.string(),
    rejectionReason: v.optional(v.string()),
    rejectionKind: v.optional(v.union(v.literal("review"), v.literal("print_failed"))),
    dimensionsMm: v.optional(v.object({ x: v.number(), y: v.number(), z: v.number() })),
    reviewedBy: v.optional(v.string()),
    // Sort key within the print queue; set when status becomes "queued".
    queueOrder: v.optional(v.number()),
    queuedAt: v.optional(v.number()),
    printingAt: v.optional(v.number()),
    // Name of the printer staff put this job on; optional.
    printer: v.optional(v.string()),
    doneAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    version: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedRoles: v.optional(v.object({ vote: v.boolean(), print: v.boolean() })),
    participantNotice: v.optional(
      v.object({
        kind: v.union(v.literal("replaced"), v.literal("withdrawn"), v.literal("restored")),
        version: v.number(),
        at: v.number(),
      })
    ),
  })
    .index("by_participant", ["participantId"])
    .index("by_status", ["status"])
    .index("by_status_queueOrder", ["status", "queueOrder"])
    .index("by_printCode", ["printCode"]),

  votes: defineTable({
    voterId: v.id("participants"),
    submissionId: v.id("submissions"),
    version: v.optional(v.number()),
  })
    .index("by_voter", ["voterId"])
    .index("by_submission", ["submissionId"])
    .index("by_voter_submission", ["voterId", "submissionId"]),

  // Swipe-deck reactions. One row per participant per submission; ranking
  // tie-breaker after votes.
  likes: defineTable({
    participantId: v.id("participants"),
    submissionId: v.id("submissions"),
    reaction: v.union(v.literal("like"), v.literal("skip")),
    updatedAt: v.number(),
    version: v.optional(v.number()),
  })
    .index("by_participant", ["participantId"])
    .index("by_submission", ["submissionId"])
    .index("by_participant_submission", ["participantId", "submissionId"]),

  // Singleton row; read through settings.get which falls back to defaults.
  settings: defineTable({
    submissionsOpen: v.boolean(),
    votingOpen: v.boolean(),
    showResultsOnTv: v.boolean(),
    maxFileBytes: v.number(),
    colours: v.array(v.string()),
    nextPrintNumber: v.number(),
    submissionsDeadline: v.optional(v.number()),
    announcement: v.optional(v.string()),
    announcementUpdatedAt: v.optional(v.number()),
    // First time submissions were opened; distinguishes "not open yet" from closed.
    submissionsOpenedAt: v.optional(v.number()),
    votingOpenedAt: v.optional(v.number()),
    maxDimensionsMm: v.optional(v.object({ x: v.number(), y: v.number(), z: v.number() })),
    printers: v.optional(v.array(v.object({ name: v.string(), colours: v.array(v.string()) }))),
  }),

  auditLog: defineTable({
    actor: v.string(),
    action: v.string(),
    submissionId: v.optional(v.id("submissions")),
    detail: v.optional(v.string()),
  })
    .index("by_submission", ["submissionId"])
    .index("by_action", ["action"]),

  submissionVersions: defineTable({
    submissionId: v.id("submissions"),
    version: v.number(),
    storageId: v.id("_storage"),
    previewStorageId: v.optional(v.id("_storage")),
    originalFileName: v.string(),
    kind: fileKind,
    sizeBytes: v.number(),
    dimensionsMm: v.optional(v.object({ x: v.number(), y: v.number(), z: v.number() })),
    archivedAt: v.number(),
    why: v.union(v.literal("replaced"), v.literal("restored")),
  })
    .index("by_submission", ["submissionId"])
    .index("by_storageId", ["storageId"])
    .index("by_previewStorageId", ["previewStorageId"]),
});
