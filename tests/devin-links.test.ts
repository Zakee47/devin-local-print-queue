import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  DEVIN_NEW_SESSION_URL,
  devinStartPrompt,
  devinStartUrl,
  PLAYBOOK_PATH,
} from "../lib/devin-links";

const playbook = readFileSync("public/keychain-playbook.md", "utf8");

describe("Devin links", () => {
  test.each([
    "https://keychains.example.com",
    `https://${"workshop.".repeat(80)}keychains.example.com`,
  ])("creates a short prompt URL for %s", (origin) => {
    const url = devinStartUrl(origin);
    expect(url.length).toBeLessThan(6000);
    expect(url.startsWith(`${DEVIN_NEW_SESSION_URL}?prompt=`)).toBe(true);
    expect(decodeURIComponent(url.slice(url.indexOf("?prompt=") + "?prompt=".length))).toBe(
      devinStartPrompt(origin)
    );
    expect(decodeURIComponent(url)).toContain(`${origin}${PLAYBOOK_PATH}`);
  });

  test("never embeds the playbook in a link", () => {
    const origin = "https://keychains.example.com";
    const urls = [devinStartUrl(origin)];
    const excerpt = playbook.slice(0, 200);

    for (const url of urls) {
      expect(url.length).toBeLessThan(6000);
      expect(decodeURIComponent(url)).not.toContain(excerpt);
      expect(url.length).toBeLessThan(playbook.length);
    }
  });
});
