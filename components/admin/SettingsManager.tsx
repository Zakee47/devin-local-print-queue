"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  COLOUR_DISCLAIMER,
  MAX_BLAST_MESSAGE_LENGTH,
  type Dimensions,
  type Printer,
} from "@/lib/event";
import { swatchFor } from "@/lib/colours";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { submissionsStatusText } from "@/components/admin/countdown";
import { useNow } from "@/components/admin/use-now";
import { errorMessage } from "@/lib/errors";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-[14rem_1fr] sm:gap-8">
      <div>
        <h2 className="font-heading text-base font-medium tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function formatLocalDateTime(ms: number | undefined): string {
  if (ms === undefined) return "";
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function cleanPrinters(printers: Printer[], palette: string[]): Printer[] {
  return printers.map((printer) => ({
    ...printer,
    colours: printer.colours.filter((colour) =>
      palette.some((paletteColour) => paletteColour.toLowerCase() === colour.toLowerCase())
    ),
  }));
}

export default function SettingsManager() {
  const settings = useQuery(api.settings.get);
  const update = useMutation(api.settings.update);
  const now = useNow();
  const [newColour, setNewColour] = useState("");
  const [maxMb, setMaxMb] = useState<string | null>(null);
  const [deadlineInput, setDeadlineInput] = useState<string | null>(null);
  const [announcementInput, setAnnouncementInput] = useState<string | null>(null);
  const [dimensionInput, setDimensionInput] = useState<{ x: string; y: string; z: string } | null>(null);
  const [printersDraft, setPrintersDraft] = useState<Printer[] | null>(null);
  const [newPrinter, setNewPrinter] = useState("");

  if (!settings) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const save = async (patch: Parameters<typeof update>[0], message: string) => {
    try {
      await update(patch);
      toast.success(message);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const colours = settings.colours;
  const currentPrinters = cleanPrinters(printersDraft ?? settings.printers, colours);
  const currentMb = String(Math.round((settings.maxFileBytes / 1024 / 1024) * 10) / 10);
  const deadlineValue = deadlineInput ?? formatLocalDateTime(settings.submissionsDeadline);
  const announcementValue = announcementInput ?? settings.announcement ?? "";
  const dimensions: Dimensions = settings.maxDimensionsMm;
  const dimensionValues = dimensionInput ?? {
    x: String(dimensions.x),
    y: String(dimensions.y),
    z: String(dimensions.z),
  };

  function savePrinters(next: Printer[], message: string, palette = colours) {
    const cleaned = cleanPrinters(next, palette);
    setPrintersDraft(cleaned);
    void save({ printers: cleaned }, message);
  }

  function savePalette(next: string[], message: string) {
    const updatedPrinters = cleanPrinters(currentPrinters, next);
    setPrintersDraft(updatedPrinters);
    void save({ colours: next, printers: updatedPrinters }, message);
  }

  const moveColour = (i: number, delta: number) => {
    const next = [...colours];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    savePalette(next, "Palette reordered");
  };

  function addDeadline(minutes: number) {
    const current = settings?.submissionsDeadline;
    const base = current !== undefined && current > now ? current : now;
    const next = base + minutes * 60 * 1000;
    setDeadlineInput(formatLocalDateTime(next));
    void save({ submissionsDeadline: next }, "Submission deadline updated");
  }

  return (
    <div className="flex flex-col gap-8">
      <Section title="Submissions" description="Manage the submission window, deadline and blast message.">
        <FieldGroup>
          <Field>
            <FieldLabel>Submission intake</FieldLabel>
            <ToggleGroup
              value={[settings.submissionsOpen ? "open" : "closed"]}
              onValueChange={(value) => {
                const selected = value[0];
                if (selected === "open" || selected === "closed") {
                  void save({ submissionsOpen: selected === "open" }, `Submissions ${selected}`);
                }
              }}
              aria-label="Submission intake"
            >
              <ToggleGroupItem value="open" variant="outline">Open</ToggleGroupItem>
              <ToggleGroupItem value="closed" variant="outline">Closed</ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const deadline = new Date(deadlineValue).getTime();
              if (!deadlineValue || !Number.isFinite(deadline)) {
                toast.error("Choose a valid submission deadline");
                return;
              }
              setDeadlineInput(deadlineValue);
              void save({ submissionsDeadline: deadline }, "Submission deadline saved");
            }}
          >
            <Field className="w-full max-w-sm">
              <FieldLabel htmlFor="submissions-deadline">Deadline</FieldLabel>
              <Input
                id="submissions-deadline"
                type="datetime-local"
                value={deadlineValue}
                onChange={(event) => setDeadlineInput(event.target.value)}
              />
            </Field>
            <Button type="submit" variant="outline">Save deadline</Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => addDeadline(15)}>+15 min</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addDeadline(30)}>+30 min</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addDeadline(60)}>+1 h</Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDeadlineInput("");
                void save({ submissionsDeadline: null }, "Submission deadline cleared");
              }}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void save({ submissionsOpen: false }, "Submissions closed")}
            >
              Close now
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{submissionsStatusText(settings, now)}</p>

          <form
            className="flex flex-col items-start gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const announcement = announcementValue.trim();
              setAnnouncementInput(announcement);
              void save({ announcement }, "Blast sent");
            }}
          >
            <Field className="w-full">
              <FieldLabel htmlFor="announcement">Blast message</FieldLabel>
              <Textarea
                id="announcement"
                rows={3}
                maxLength={MAX_BLAST_MESSAGE_LENGTH}
                value={announcementValue}
                onChange={(event) => setAnnouncementInput(event.target.value)}
                placeholder="Share an update with everyone"
              />
            </Field>
            <Button type="submit" variant="outline">Send blast</Button>
          </form>
        </FieldGroup>
      </Section>
      <Separator />

      <Section title="Printers" description={COLOUR_DISCLAIMER}>
        <div className="flex flex-col gap-4">
          <ul className="divide-y divide-border border-y border-border">
            {currentPrinters.map((printer, index) => (
              <li key={`${printer.name}-${index}`} className="flex flex-col gap-3 py-4">
                <div className="flex flex-wrap items-end gap-2">
                  <Field className="min-w-48 flex-1">
                    <FieldLabel htmlFor={`printer-name-${index}`}>Printer name</FieldLabel>
                    <Input
                      id={`printer-name-${index}`}
                      value={printer.name}
                      onChange={(event) =>
                        setPrintersDraft(
                          currentPrinters.map((item, i) =>
                            i === index ? { ...item, name: event.target.value } : item
                          )
                        )
                      }
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => savePrinters(currentPrinters, "Printer saved")}
                  >
                    Save name
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${printer.name}`}
                    onClick={() =>
                      savePrinters(
                        currentPrinters.filter((_, i) => i !== index),
                        "Printer removed"
                      )
                    }
                  >
                    <X />
                  </Button>
                </div>
                {colours.length > 0 ? (
                  <FieldSet>
                    <FieldLegend variant="label">Loaded colours</FieldLegend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {colours.map((colour) => {
                        const checked = printer.colours.some(
                          (loaded) => loaded.toLowerCase() === colour.toLowerCase()
                        );
                        const id = `printer-${index}-colour-${colour}`;
                        return (
                          <Field key={colour} orientation="horizontal">
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(value) => {
                                const next = currentPrinters.map((item, i) => {
                                  if (i !== index) return item;
                                  const loadedColours = item.colours.filter(
                                    (loaded) => loaded.toLowerCase() !== colour.toLowerCase()
                                  );
                                  return {
                                    ...item,
                                    colours:
                                      value === true
                                        ? [...loadedColours, colour]
                                        : loadedColours,
                                  };
                                });
                                savePrinters(next, `${printer.name} colours saved`);
                              }}
                            />
                            <FieldLabel htmlFor={id} className="font-normal">
                              <span
                                aria-hidden="true"
                                className="size-3 rounded-full ring-1 ring-foreground/20"
                                style={{ background: swatchFor(colour) }}
                              />
                              {colour}
                            </FieldLabel>
                          </Field>
                        );
                      })}
                    </div>
                  </FieldSet>
                ) : (
                  <FieldDescription>No colours are currently in the palette.</FieldDescription>
                )}
              </li>
            ))}
          </ul>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newPrinter.trim();
              if (!name) return;
              if (currentPrinters.some((printer) => printer.name.toLowerCase() === name.toLowerCase())) {
                toast.error(`${name} already exists`);
                return;
              }
              savePrinters([...currentPrinters, { name, colours: [] }], `${name} added`);
              setNewPrinter("");
            }}
          >
            <Field className="w-full max-w-sm">
              <FieldLabel htmlFor="new-printer">Add a printer</FieldLabel>
              <Input
                id="new-printer"
                value={newPrinter}
                onChange={(event) => setNewPrinter(event.target.value)}
                placeholder="Printer name"
              />
            </Field>
            <Button type="submit" disabled={!newPrinter.trim()}>
              <Plus data-icon="inline-start" />
              Add printer
            </Button>
          </form>
        </div>
      </Section>
      <Separator />

      <Section title="Max dimensions" description="Maximum model dimensions, in millimetres, in any orientation.">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const maxDimensionsMm = {
              x: Number(dimensionValues.x),
              y: Number(dimensionValues.y),
              z: Number(dimensionValues.z),
            };
            if (Object.values(maxDimensionsMm).some((value) => !Number.isFinite(value) || value <= 0)) {
              toast.error("Enter positive dimensions for X, Y and Z");
              return;
            }
            setDimensionInput({
              x: String(maxDimensionsMm.x),
              y: String(maxDimensionsMm.y),
              z: String(maxDimensionsMm.z),
            });
            void save({ maxDimensionsMm }, "Maximum dimensions saved");
          }}
        >
          {(["x", "y", "z"] as const).map((axis) => (
            <Field key={axis} className="w-24">
              <FieldLabel htmlFor={`max-dimension-${axis}`}>{axis.toUpperCase()} mm</FieldLabel>
              <Input
                id={`max-dimension-${axis}`}
                type="number"
                min="0.1"
                step="any"
                value={dimensionValues[axis]}
                onChange={(event) =>
                  setDimensionInput({ ...dimensionValues, [axis]: event.target.value })
                }
              />
            </Field>
          ))}
          <Button type="submit" variant="outline">Save dimensions</Button>
        </form>
      </Section>
      <Separator />

      <Section title="Max file size" description="Uploads above this are refused.">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const mb = Number(maxMb ?? currentMb);
            if (!Number.isFinite(mb) || mb <= 0) return toast.error("Enter a size in MB");
            void save({ maxFileBytes: Math.round(mb * 1024 * 1024) }, `Max file size set to ${mb} MB`);
            setMaxMb(null);
          }}
        >
          <Field className="max-w-xs">
            <FieldLabel htmlFor="max-mb">Megabytes</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="max-mb"
                type="number"
                min={1}
                step="any"
                value={maxMb ?? currentMb}
                onChange={(event) => setMaxMb(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" variant="default" size="xs" disabled={maxMb === null}>
                  Save
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </form>
      </Section>
      <Separator />

      <Section title="Colour palette" description="Participants pick a requested colour. Requests are not guaranteed.">
        <ul className="mb-4 divide-y divide-border border-y border-border">
          {colours.map((colour, index) => (
            <li key={colour} className="flex min-h-11 items-center gap-3 px-1 py-1.5">
              <span
                aria-hidden="true"
                className="size-4 rounded-full ring-1 ring-foreground/20"
                style={{ background: swatchFor(colour) }}
              />
              <span className="flex-1 text-sm">{colour}</span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Move ${colour} up`}
                disabled={index === 0}
                onClick={() => moveColour(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Move ${colour} down`}
                disabled={index === colours.length - 1}
                onClick={() => moveColour(index, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${colour}`}
                className="text-muted-foreground"
                onClick={() =>
                  savePalette(
                    colours.filter((item) => item !== colour),
                    `${colour} removed`
                  )
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const name = newColour.trim();
            if (!name) return;
            if (colours.some((colour) => colour.toLowerCase() === name.toLowerCase())) {
              return toast.error(`${name} is already in the palette`);
            }
            savePalette([...colours, name], `${name} added`);
            setNewColour("");
          }}
        >
          <Field className="max-w-sm">
            <FieldLabel htmlFor="new-colour">Add a colour</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="new-colour"
                value={newColour}
                onChange={(event) => setNewColour(event.target.value)}
                placeholder="Silk gold"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" variant="default" size="xs" disabled={!newColour.trim()}>
                  <Plus data-icon="inline-start" />
                  Add
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>Common names (red, blue…) get a swatch; any CSS colour works too.</FieldDescription>
          </Field>
        </form>
      </Section>
    </div>
  );
}
