import { describe, expect, it } from "vitest";
import { voteAnnouncement } from "../components/vote/announce";

describe("voteAnnouncement", () => {
  it("announces a cast with one vote left", () => {
    expect(voteAnnouncement({ kind: "cast", title: "First Bug", votesLeft: 1 })).toBe(
      "Vote cast for First Bug. 1 vote left."
    );
  });

  it("announces a cast with no votes left", () => {
    expect(voteAnnouncement({ kind: "cast", title: "First Bug", votesLeft: 0 })).toBe(
      "Vote cast for First Bug. No votes left."
    );
  });

  it("announces a retracted vote with plural votes left", () => {
    expect(voteAnnouncement({ kind: "retract", title: "First Bug", votesLeft: 2 })).toBe(
      "Vote removed from First Bug. 2 votes left."
    );
  });

  it("announces a swapped vote", () => {
    expect(voteAnnouncement({ kind: "swap", from: "First Bug", to: "Enigma Rotor" })).toBe(
      "Vote moved from First Bug to Enigma Rotor."
    );
  });
});
