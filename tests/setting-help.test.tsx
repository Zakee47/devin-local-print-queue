import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SettingHelp from "@/components/admin/SettingHelp";
import { SETTINGS_HELP, type SettingHelpCopy } from "@/lib/settings-help";

describe("SettingHelp", () => {
  it("renders a labelled help button", () => {
    const html = renderToStaticMarkup(<SettingHelp {...SETTINGS_HELP.voting} />);
    expect(html).toContain('aria-label="What does Voting do?"');
    expect(html).toContain("<button");
  });

  it("has complete, jargon-free copy for every setting", () => {
    for (const copy of Object.values(SETTINGS_HELP) as SettingHelpCopy[]) {
      const fields = [copy.title, copy.what, copy.on.label, copy.on.text, copy.off.label, copy.off.text];
      for (const field of fields) expect(field.trim()).not.toBe("");
      const text = [...fields, copy.note ?? ""].join(" ");
      expect(text).not.toMatch(/\b(mutation|row|version|keepVotesOnReplace)\b/i);
    }
  });
});
