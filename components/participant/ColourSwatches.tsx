"use client";

import { Check } from "lucide-react";
import { swatchFor } from "@/lib/colours";
import { cn } from "@/lib/utils";

// Swatch radio group; "" means any colour.
export default function ColourSwatches({
  colours,
  value,
  onChange,
  disabled,
  name,
}: {
  colours: string[];
  value: string;
  onChange: (colour: string) => void;
  disabled?: boolean;
  name: string;
}) {
  const options = ["", ...colours];
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Colour request (not guaranteed)</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {options.map((colour) => {
          const selected = value.toLowerCase() === colour.toLowerCase();
          const label = colour || "Any";
          return (
            <label
              key={colour || "any"}
              title={label}
              className={cn(
                "relative grid size-10 cursor-pointer place-items-center rounded-full border border-border-strong transition-shadow has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring has-disabled:cursor-not-allowed has-disabled:opacity-50",
                selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
              )}
              style={
                colour
                  ? { backgroundColor: swatchFor(colour) }
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
                aria-label={label}
              />
              {selected ? (
                <Check
                  className="size-4 drop-shadow"
                  style={{ color: colour.toLowerCase() === "white" || colour.toLowerCase() === "yellow" ? "#202020" : "#fff" }}
                  aria-hidden="true"
                />
              ) : null}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Selected: <span className="font-medium text-foreground">{value || "Any colour"}</span>
      </p>
    </fieldset>
  );
}
