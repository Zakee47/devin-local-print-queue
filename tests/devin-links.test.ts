import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  DEVIN_NEW_SESSION_URL,
  DEVIN_PLAYBOOK_CREATE_URL,
  devinPlaybookCreateUrl,
  devinPlaybookStub,
  devinStartPrompt,
  devinStartUrl,
  PLAYBOOK_PATH,
} from "../lib/devin-links";

const playbook = readFileSync("public/keychain-playbook.md", "utf8");

describe("Devin links", () => {
  test.each([
    "https://keychains.example.com",
    `https://${"workshop.".repeat(80)}keychains.example.com`,
  ])("creates short prompt and playbook URLs for %s", (origin) => {
    const url = devinStartUrl(origin);
    expect(url.length).toBeLessThan(6000);
    expect(url.startsWith(`${DEVIN_NEW_SESSION_URL}?prompt=`)).toBe(true);
    expect(decodeURIComponent(url.slice(url.indexOf("?prompt=") + "?prompt=".length))).toBe(
      devinStartPrompt(origin)
    );
    expect(decodeURIComponent(url)).toContain(`${origin}${PLAYBOOK_PATH}`);

    const playbookUrl = devinPlaybookCreateUrl(origin);
    expect(playbookUrl.length).toBeLessThan(6000);
    expect(playbookUrl.startsWith(`${DEVIN_PLAYBOOK_CREATE_URL}?body=`)).toBe(true);
    expect(
      decodeURIComponent(
        playbookUrl.slice(
          playbookUrl.indexOf("?body=") + "?body=".length
        )
      )
    ).toBe(devinPlaybookStub(origin));
    expect(decodeURIComponent(playbookUrl)).toContain(`${origin}${PLAYBOOK_PATH}`);
  });

  test("uses the generic playbook creation page", () => {
    expect(DEVIN_PLAYBOOK_CREATE_URL).toBe("https://app.devin.ai/settings/playbooks/create");
    expect(DEVIN_PLAYBOOK_CREATE_URL).not.toContain("?");
  });

  test("never embeds the playbook in either link", () => {
    const origin = "https://keychains.example.com";
    const urls = [
      DEVIN_PLAYBOOK_CREATE_URL,
      devinStartUrl(origin),
      devinPlaybookCreateUrl(origin),
    ];
    const excerpt = playbook.slice(0, 200);

    for (const url of urls) {
      expect(url.length).toBeLessThan(6000);
      expect(decodeURIComponent(url)).not.toContain(excerpt);
      expect(url.length).toBeLessThan(playbook.length);
    }
  });
});
