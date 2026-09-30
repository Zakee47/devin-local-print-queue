import { ALLOWED_EXTENSIONS } from "./event";

export type FileKind = (typeof ALLOWED_EXTENSIONS)[number];

export function fileKindFromName(name: string): FileKind | null {
  const ext = name.split(".").pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.find((k) => k === ext) ?? null;
}

export function slugPart(value: string, max = 24) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/g, "") || "x"
  );
}

// Filename used when an organizer downloads a submission, so files sort by
// print code and are recognisable on the printer:
//   KC-007_ada-lovelace_red_rocket-keychain.3mf
export function downloadFileName(input: {
  printCode: string;
  participantName: string;
  colour?: string;
  title: string;
  kind: FileKind;
}) {
  const parts = [
    input.printCode,
    slugPart(input.participantName),
    input.colour ? slugPart(input.colour, 12) : "any-colour",
    slugPart(input.title, 32),
  ];
  return `${parts.join("_")}.${input.kind}`;
}

export function formatPrintCode(n: number) {
  return `KC-${String(n).padStart(3, "0")}`;
}

export function displayNameFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Anonymous";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
