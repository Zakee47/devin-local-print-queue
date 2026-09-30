import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { submissionStatus, fileKind } from "./validators";

export default defineSchema({
  // Organizers. Seed the first row from the Convex dashboard.
  admins: defineTable({
    email: v.string(),
  }).index("by_email", ["email"]),

  // Eligibility allowlist, replaced wholesale by each Luma CSV upload.
  guests: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    checkedIn: v.boolean(),
    importId: v.id("guestImports"),
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
    // Public label for the TV and gallery, e.g. "Ada L."
    displayName: v.string(),
  })
    .index("by_email", ["email"])
    .index("by_clerkUserId", ["clerkUserId"]),

  submissions: defineTable({
    participantId: v.id("participants"),
    storageId: v.id("_storage"),
    originalFileName: v.string(),
    kind: fileKind,
    sizeBytes: v.number(),
    title: v.string(),
    notes: v.optional(v.string()),
    // Requested filament colour; best effort, not guaranteed.
    colour: v.optional(v.string()),
    // At most one active submission per participant has this set.
    printRequested: v.boolean(),
    status: submissionStatus,
    // Human-friendly sequential code, e.g. "KC-007", assigned on creation.
    printCode: v.string(),
    rejectionReason: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),
    // Sort key within the print queue; set when status becomes "queued".
    queueOrder: v.optional(v.number()),
    queuedAt: v.optional(v.number()),
    printingAt: v.optional(v.number()),
    doneAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
  })
    .index("by_participant", ["participantId"])
    .index("by_status", ["status"])
    .index("by_status_queueOrder", ["status", "queueOrder"])
    .index("by_printCode", ["printCode"]),

  votes: defineTable({
    voterId: v.id("participants"),
    submissionId: v.id("submissions"),
  })
    .index("by_voter", ["voterId"])
    .index("by_submission", ["submissionId"])
    .index("by_voter_submission", ["voterId", "submissionId"]),

  // Singleton row; read through settings.get which falls back to defaults.
  settings: defineTable({
    submissionsOpen: v.boolean(),
    votingOpen: v.boolean(),
    showResultsOnTv: v.boolean(),
    maxFileBytes: v.number(),
    colours: v.array(v.string()),
    nextPrintNumber: v.number(),
  }),

  auditLog: defineTable({
    actor: v.string(),
    action: v.string(),
    submissionId: v.optional(v.id("submissions")),
    detail: v.optional(v.string()),
  }).index("by_submission", ["submissionId"]),
});
