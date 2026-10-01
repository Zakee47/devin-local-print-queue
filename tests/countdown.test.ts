import { describe, expect, it } from "vitest";
import { formatRemaining, submissionsStatusText } from "@/components/admin/countdown";

describe("formatRemaining", () => {
  it("formats hours, minutes and seconds", () => {
    expect(formatRemaining(65 * 60 * 1000)).toBe("1h 05m");
    expect(formatRemaining(12 * 60 * 1000 + 3 * 1000)).toBe("12m 03s");
    expect(formatRemaining(45 * 1000)).toBe("45s");
  });
});

describe("submissionsStatusText", () => {
  const deadline = new Date(2026, 2, 1, 15, 25).getTime();

  it("describes closed and open windows without a deadline", () => {
    expect(submissionsStatusText({ submissionsOpen: false }, 0)).toBe("Submissions are closed");
    expect(submissionsStatusText({ submissionsOpen: true }, 0)).toBe("Submissions are open");
  });

  it("shows the remaining time and local deadline time", () => {
    expect(
      submissionsStatusText(
        { submissionsOpen: true, submissionsDeadline: deadline },
        deadline - 15 * 60 * 1000
      )
    ).toMatch(/^Submissions close in 15m 00s \(at \d{2}:\d{2}\)$/);
  });

  it("shows when a deadline has passed", () => {
    expect(
      submissionsStatusText({ submissionsOpen: true, submissionsDeadline: deadline }, deadline)
    ).toMatch(/^Submissions closed at \d{2}:\d{2}$/);
  });
});
