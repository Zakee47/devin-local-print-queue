import type { ColourCode } from "@/lib/event";

// Maps palette names to swatch/preview colours; unknown names fall back to
// being used as CSS colour strings directly.
const SWATCHES: Record<string, string> = {
  black: "#1f1f1f",
  white: "#f2f2f2",
  grey: "#8a8a8a",
  gray: "#8a8a8a",
  red: "#d93636",
  blue: "#2f6fe0",
  green: "#2e9e5b",
  silver: "#c0c4c8",
  gold: "#d4a93a",
  "sea green": "#2e8b57",
  "sky blue": "#6ec3f4",
  yellow: "#f2c230",
  orange: "#f07f23",
  purple: "#8a4fd8",
  pink: "#ef7fb4",
};

export function swatchFor(colour?: string | null, codes?: ColourCode[]) {
  if (!colour) return "#467bf7";
  const key = colour.trim().toLowerCase();
  return codes?.find((code) => code.name.trim().toLowerCase() === key)?.hex ??
    SWATCHES[key] ??
    colour;
}
