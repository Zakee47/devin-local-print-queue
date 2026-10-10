"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pause, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  COLOUR_DISCLAIMER,
  MAX_BLAST_MESSAGE_LENGTH,
  type ColourCode,
  type Dimensions,
  type Printer,
} from "@/lib/event";
import { useSwatch } from "@/lib/use-swatch";
import { swatchFor } from "@/lib/colours";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Switch } from "@/components/ui/switch";
import { submissionsStatusText } from "@/components/admin/countdown";
import { useNow } from "@/components/admin/use-now";
import { errorMessage } from "@/lib/errors";
import { SETTINGS_HELP, type SettingHelpCopy } from "@/lib/settings-help";
import SettingHelp from "@/components/admin/SettingHelp";

type SettingsConfirmation =
  | { type: "pause"; printer: string; queuedJobs: number }
  | { type: "remove-printer"; printer: string; nextPrinters: Printer[] }
  | { type: "remove-colour"; colour: string; nextColours: string[] }
  | { type: "close-submissions" };

function Section({
  title,
  description,
  help,
  children,
}: {
  title: string;
  description: string;
  help?: SettingHelpCopy;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-[14rem_1fr] sm:gap-8">
      <div>
        <div className="flex items-center gap-1">
          <h2 className="font-heading text-base font-medium tracking-tight">{title}</h2>
          {help ? <SettingHelp {...help} /> : null}
        </div>
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

function ColourCodeInput({
  name,
  value,
  onCommit,
}: {
  name: string;
  value: string;
  onCommit: (hex: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(value);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const commit = () => {
      if (input.value.toLowerCase() !== value.toLowerCase()) onCommit(input.value);
    };
    input.addEventListener("change", commit);
    return () => input.removeEventListener("change", commit);
  }, [onCommit, value]);

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <input
        ref={inputRef}
        aria-label={`${name} colour code`}
        type="color"
        value={preview}
        onChange={(event) => setPreview(event.currentTarget.value)}
        className="size-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
      />
      <code>{preview}</code>
    </label>
  );
}

export default function SettingsManager() {
  const settings = useQuery(api.settings.get);
  const boardRows = useQuery(api.queue.board);
  const update = useMutation(api.settings.update);
  const swatch = useSwatch();
  const now = useNow();
  const [newColour, setNewColour] = useState("");
  const [newColourHex, setNewColourHex] = useState("#888888");
  const [newColourHexTouched, setNewColourHexTouched] = useState(false);
  const [maxMb, setMaxMb] = useState<string | null>(null);
  const [deadlineInput, setDeadlineInput] = useState<string | null>(null);
  const [announcementInput, setAnnouncementInput] = useState<string | null>(null);
  const [dimensionInput, setDimensionInput] = useState<{ x: string; y: string; z: string } | null>(null);
  const [printersDraft, setPrintersDraft] = useState<Printer[] | null>(null);
  const [newPrinter, setNewPrinter] = useState("");
  const [confirmation, setConfirmation] = useState<SettingsConfirmation | null>(null);

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
  const suggestedNewColourHex = swatchFor(newColour.trim());
  const knownNewColourHex = /^#[0-9a-f]{6}$/i.test(suggestedNewColourHex)
    ? suggestedNewColourHex
    : null;
  const defaultNewColourHex = knownNewColourHex ?? "#888888";
  const displayedNewColourHex = newColourHexTouched ? newColourHex : defaultNewColourHex;
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
  const confirmationTitle =
    confirmation?.type === "pause"
      ? `Pause ${confirmation.printer}?`
      : confirmation?.type === "remove-printer"
        ? `Remove ${confirmation.printer}?`
        : confirmation?.type === "remove-colour"
          ? `Remove ${confirmation.colour} from the palette?`
          : "Close submissions?";
  const confirmationDescription =
    confirmation?.type === "pause"
      ? `${confirmation.queuedJobs > 0 ? `${confirmation.queuedJobs} queued ${confirmation.queuedJobs === 1 ? "job" : "jobs"} on it will need reassigning. ` : ""}It keeps its loaded colours and you can resume any time.`
      : confirmation?.type === "remove-printer"
        ? "Its loaded colours will be lost."
        : confirmation?.type === "remove-colour"
          ? "It will be unticked on every printer, and participants can no longer pick it."
          : "Participants can't upload or replace files until you reopen.";

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

  function confirmSettingsAction() {
    const action = confirmation;
    if (!action) return;
    setConfirmation(null);
    if (action.type === "pause") {
      savePrinters(
        currentPrinters.map((printer) =>
          printer.name === action.printer ? { ...printer, outOfService: true } : printer
        ),
        `${action.printer} paused`
      );
    } else if (action.type === "remove-printer") {
      savePrinters(action.nextPrinters, "Printer removed");
    } else if (action.type === "remove-colour") {
      savePalette(action.nextColours, `${action.colour} removed`);
    } else {
      void save({ submissionsOpen: false }, "Submissions closed");
    }
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
            <div className="flex items-center gap-1">
              <FieldLabel>Submission intake</FieldLabel>
              <SettingHelp {...SETTINGS_HELP.submissionIntake} />
            </div>
            <ToggleGroup
              value={[settings.submissionsOpen ? "open" : "closed"]}
              onValueChange={(value) => {
                const selected = value[0];
                if (selected === "open" || selected === "closed") {
                  if (selected === "closed" && settings.submissionsOpen) {
                    setConfirmation({ type: "close-submissions" });
                  } else if (selected === "open" && !settings.submissionsOpen) {
                    void save({ submissionsOpen: true }, "Submissions open");
                  }
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
              <div className="flex items-center gap-1">
                <FieldLabel htmlFor="submissions-deadline">Deadline</FieldLabel>
                <SettingHelp {...SETTINGS_HELP.deadline} />
              </div>
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
              onClick={() => {
                if (settings.submissionsOpen) setConfirmation({ type: "close-submissions" });
              }}
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
              <div className="flex items-center gap-1">
                <FieldLabel htmlFor="announcement">Blast message</FieldLabel>
                <SettingHelp {...SETTINGS_HELP.blast} />
              </div>
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

      <Section title="Printers" description={COLOUR_DISCLAIMER} help={SETTINGS_HELP.printers}>
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
                      setConfirmation({
                        type: "remove-printer",
                        printer: printer.name,
                        nextPrinters: currentPrinters.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X />
                  </Button>
                  <div className="flex items-center gap-2">
                    <FieldLabel htmlFor={`printer-${index}-in-service`} className="font-normal">
                      In service
                    </FieldLabel>
                    <Switch
                      id={`printer-${index}-in-service`}
                      checked={!printer.outOfService}
                      disabled={boardRows === undefined}
                      onCheckedChange={(inService) => {
                        if (inService) {
                          savePrinters(
                            currentPrinters.map((item, i) =>
                              i === index ? { ...item, outOfService: false } : item
                            ),
                            `${printer.name} resumed`
                          );
                        } else if (boardRows) {
                          setConfirmation({
                            type: "pause",
                            printer: printer.name,
                            queuedJobs: boardRows.filter(
                              (row) => row.status === "queued" && row.printer === printer.name
                            ).length,
                          });
                        }
                      }}
                    />
                  </div>
                </div>
                {printer.outOfService ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <Pause aria-hidden className="size-4 shrink-0" />
                    <span className="flex-1 text-sm">Paused: not taking new jobs</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        savePrinters(
                          currentPrinters.map((item, i) =>
                            i === index ? { ...item, outOfService: false } : item
                          ),
                          `${printer.name} resumed`
                        )
                      }
                    >
                      Resume
                    </Button>
                  </div>
                ) : null}
                {colours.length > 0 ? (
                  <FieldSet>
                    <FieldLegend variant="label" className="flex items-center gap-1">
                      Loaded colours
                      <SettingHelp {...SETTINGS_HELP.loadedColours} />
                    </FieldLegend>
                    <div className={`flex flex-wrap gap-x-5 gap-y-2${printer.outOfService ? " opacity-50 grayscale" : ""}`}>
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
                                style={{ background: swatch(colour) }}
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

      <Section title="Max dimensions" description="Maximum model dimensions, in millimetres, in any orientation."
        help={SETTINGS_HELP.maxDimensions}
      >
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

      <Section title="Max file size" description="Uploads above this are refused." help={SETTINGS_HELP.maxFileSize}>
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

      <Section title="Colour palette" description="Participants pick a requested colour. Requests are not guaranteed."
        help={SETTINGS_HELP.colourPalette}
      >
        <ul className="mb-4 divide-y divide-border border-y border-border">
          {colours.map((colour, index) => (
            <li key={colour} className="flex min-h-11 flex-wrap items-center gap-3 px-1 py-1.5">
              <span
                aria-hidden="true"
                className="size-4 rounded-full ring-1 ring-foreground/20"
                style={{ background: swatch(colour) }}
              />
              <span className="flex-1 text-sm">{colour}</span>
              {(() => {
                const code = settings.colourCodes?.find(
                  (item) => item.name.toLowerCase() === colour.toLowerCase()
                );
                const effective = swatch(colour);
                const inputValue = /^#[0-9a-f]{6}$/i.test(effective) ? effective : "#888888";
                return (
                  <ColourCodeInput
                    key={code?.hex ?? inputValue}
                    name={colour}
                    value={code?.hex ?? inputValue}
                    onCommit={(hex) => {
                      const nextCode: ColourCode = { name: colour, hex };
                      const nextCodes = [
                        ...(settings.colourCodes ?? []).filter(
                          (item) => item.name.toLowerCase() !== colour.toLowerCase()
                        ),
                        nextCode,
                      ];
                      void save({ colourCodes: nextCodes }, `${colour} colour code saved`);
                    }}
                  />
                );
              })()}
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
                  setConfirmation({
                    type: "remove-colour",
                    colour,
                    nextColours: colours.filter((item) => item !== colour),
                  })
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
            const nextColours = [...colours, name];
            const nextPrinters = cleanPrinters(currentPrinters, nextColours);
            const hasKnownSwatch = /^#[0-9a-f]{6}$/i.test(swatchFor(name));
            const nextCodes = (settings.colourCodes ?? []).filter(
              (item) => item.name.toLowerCase() !== name.toLowerCase()
            );
            if (newColourHexTouched || !hasKnownSwatch) {
              nextCodes.push({
                name,
                hex: newColourHexTouched ? newColourHex : "#888888",
              });
            }
            setPrintersDraft(nextPrinters);
            void save(
              {
                colours: nextColours,
                printers: nextPrinters,
                colourCodes: nextCodes,
              },
              `${name} added`
            );
            setNewColour("");
            setNewColourHex("#888888");
            setNewColourHexTouched(false);
          }}
        >
          <Field className="max-w-xl">
            <FieldLabel htmlFor="new-colour">Add a colour</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="new-colour"
                value={newColour}
                onChange={(event) => setNewColour(event.target.value)}
                placeholder="Silk gold"
                className="max-w-xs"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  aria-label="New colour hex code"
                  type="color"
                  value={displayedNewColourHex}
                  onChange={(event) => {
                    setNewColourHex(event.target.value);
                    setNewColourHexTouched(true);
                  }}
                  className="size-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
                <code>{displayedNewColourHex}</code>
              </label>
              <Button type="submit" variant="default" size="sm" disabled={!newColour.trim()}>
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </div>
            <FieldDescription>Choose the exact hex colour shown for this palette name.</FieldDescription>
          </Field>
        </form>
      </Section>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSettingsAction}>
              {confirmation?.type === "pause"
                ? "Pause printer"
                : confirmation?.type === "close-submissions"
                  ? "Close submissions"
                  : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
