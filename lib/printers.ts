import type { Printer } from "./event";

export function inServicePrinters(printers: Printer[]) {
  return printers.filter((printer) => !printer.outOfService);
}

export function printersWithColour(printers: Printer[], colour?: string): string[] {
  const available = inServicePrinters(printers);
  const requested = colour?.trim().toLowerCase();
  if (!requested) return available.map(({ name }) => name);
  return available
    .filter(({ colours }) => colours.some((loaded) => loaded.trim().toLowerCase() === requested))
    .map(({ name }) => name);
}

export function colourAvailable(printers: Printer[], colour: string): boolean {
  return printersWithColour(printers, colour).length > 0;
}
