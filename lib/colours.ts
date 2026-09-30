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
  yellow: "#f2c230",
  orange: "#f07f23",
  purple: "#8a4fd8",
  pink: "#ef7fb4",
};

export function swatchFor(colour?: string) {
  if (!colour) return "#467bf7";
  return SWATCHES[colour.trim().toLowerCase()] ?? colour;
}
