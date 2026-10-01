"use client";

import { useId } from "react";
import ColourSwatches from "@/components/participant/ColourSwatches";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Printer } from "@/lib/event";

export const MAX_TITLE_LENGTH = 60;
export const MAX_NOTES_LENGTH = 500;

export type SubmissionDraft = { title: string; notes: string; colour: string };

export default function SubmissionFields({
  value,
  onChange,
  colours,
  printers,
  disabled,
}: {
  value: SubmissionDraft;
  onChange: (next: SubmissionDraft) => void;
  colours: string[];
  printers: Printer[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
        <Input
          id={`${id}-title`}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Rocket keychain"
          required
          disabled={disabled}
          className="h-10 text-base sm:h-9 sm:text-sm"
        />
        <FieldDescription>
          {value.title.trim().length}/{MAX_TITLE_LENGTH}
        </FieldDescription>
      </Field>
      <ColourSwatches
        name={`${id}-colour`}
        colours={colours}
        printers={printers}
        value={value.colour}
        onChange={(colour) => onChange({ ...value, colour })}
        disabled={disabled}
      />
      <Field>
        <FieldLabel htmlFor={`${id}-notes`}>Notes for the organizers (optional)</FieldLabel>
        <Textarea
          id={`${id}-notes`}
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          maxLength={MAX_NOTES_LENGTH}
          rows={2}
          placeholder="Print with the loop at the top, etc."
          disabled={disabled}
          className="text-base sm:text-sm"
        />
      </Field>
    </div>
  );
}
