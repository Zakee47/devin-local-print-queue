import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { errorMessage } from "@/lib/errors";

describe("errorMessage", () => {
  it("returns the data of a ConvexError", () => {
    expect(errorMessage(new ConvexError("This participant already has KC-075 queued"))).toBe(
      "This participant already has KC-075 queued"
    );
  });

  it("strips the Convex request prefix from plain errors", () => {
    expect(errorMessage(new Error("[CONVEX M(queue:approve)] [Request ID: 7493e1078941baff] Server Error"))).toBe(
      "Server Error"
    );
  });

  it("extracts the uncaught message from dev-mode errors", () => {
    const message =
      "[CONVEX M(queue:approve)] [Request ID: 7493e1078941baff] Server Error\n" +
      "Uncaught Error: Submission not found\n    at handler (../convex/queue.ts:33:3)";
    expect(errorMessage(new Error(message))).toBe("Submission not found");
  });

  it("passes ordinary error messages through", () => {
    expect(errorMessage(new Error("Download failed: 404"))).toBe("Download failed: 404");
  });

  it("falls back for non-errors, empty messages and non-string ConvexError data", () => {
    expect(errorMessage("nope")).toBe("Something went wrong");
    expect(errorMessage(undefined, "Couldn't reject")).toBe("Couldn't reject");
    expect(errorMessage(new Error(""))).toBe("Something went wrong");
    expect(errorMessage(new ConvexError({ code: 1 }))).toBe("Something went wrong");
  });
});
