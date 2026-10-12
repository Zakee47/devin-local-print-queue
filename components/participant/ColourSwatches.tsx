"use client";

import { Check } from "lucide-react";
import { useSwatch } from "@/lib/use-swatch";
import { colourAvailable } from "@/lib/printers";
import { COLOUR_DISCLAIMER, type ColourDemand, type Printer } from "@/lib/event";
import { cn } from "@/lib/utils";

function waitingFor(demand: ColourDemand[] | undefined, colour: string | null) {
  const key = colour?.trim().toLowerCase() ?? "";
  return demand?.find((row) => (row.colour?.trim().toLowerCase() ?? "") === key)?.waiting ?? 0;
}

export default function ColourSwatches({
  colours,
  printers,
  demand,
  value,
  onChange,
  disabled,
  name,
}: {
  colours: string[];
  printers: Printer[];
  demand?: ColourDemand[];
  value: string;
  onChange: (colour: string) => void;
  disabled?: boolean;
  name: string;
}) {
  const swatch = useSwatch();
  const options = ["", ...colours];
  const selectedWaiting = waitingFor(demand, value || null);
  const shorterWait = value
    ? colours
        .filter(
          (colour) =>
            colour.toLowerCase() !== value.toLowerCase() &&
            colourAvailable(printers, colour) &&
            waitingFor(demand, colour) <= selectedWaiting - 2
        )
        .map((colour) => ({ colour, waiting: waitingFor(demand, colour) }))
        .sort((a, b) => a.waiting - b.waiting)[0]
    : undefined;

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Colour request</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-2" role="radiogroup">
        {options.map((colour) => {
          const selected = value.toLowerCase() === colour.toLowerCase();
          const label = colour || "Any";
          const available = !colour || colourAvailable(printers, colour);
          const waiting = waitingFor(demand, colour || null);
          return (
            <label
              key={colour || "any"}
              title={label}
              className={cn(
                "relative flex min-w-12 cursor-pointer flex-col items-center gap-1 rounded-md px-1 py-0.5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring has-disabled:cursor-not-allowed",
                !available && "opacity-50"
              )}
            >
              <span
                className={cn(
                  "relative grid size-10 place-items-center rounded-full border border-border-strong transition-shadow",
                  selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                )}
                style={
                  colour
                    ? { backgroundColor: swatch(colour) }
                    : { background: "conic-gradient(#d93636, #f2c230, #2e9e5b, #2f6fe0, #8a4fd8, #d93636)" }
                }
              >
                <input
                  type="radio"
                  name={name}
                  value={colour}
                  checked={selected}
                  onChange={() => onChange(colour)}
                  className="sr-only"
                  aria-label={`${label}${!available ? ", not available" : ""}, ${waiting} waiting`}
                />
                {selected ? (
                  <Check
                    className="size-4 drop-shadow"
                    style={{ color: colour.toLowerCase() === "white" || colour.toLowerCase() === "yellow" ? "#202020" : "#fff" }}
                    aria-hidden="true"
                  />
                ) : null}
                {!available ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 m-auto h-0.5 w-12 rotate-45 rounded-full bg-foreground/80"
                  />
                ) : null}
              </span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {demand === undefined ? "… waiting" : `${waiting} waiting`}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value ? (
          <>
            Selected: <span className="font-medium text-foreground">{value}</span>
            {" · "}
            {colourAvailable(printers, value) ? "Available" : "Not available right now"}
            {demand === undefined ? " · … waiting" : ` · ${selectedWaiting} waiting (queued or awaiting review)`}
          </>
        ) : (
          <span>
            <span className="font-medium text-foreground">Any colour</span> · goes to whichever printer is free,
            usually the shortest wait
          </span>
        )}
      </p>
      {shorterWait ? (
        <p className="text-xs text-muted-foreground">
          Shorter wait: {shorterWait.colour} ({shorterWait.waiting} waiting) or Any colour.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">{COLOUR_DISCLAIMER}</p>
    </fieldset>
  );
}
