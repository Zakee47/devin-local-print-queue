"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { swatchFor } from "@/lib/colours";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : "Failed";
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
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

export default function SettingsManager() {
  const settings = useQuery(api.settings.get);
  const role = useQuery(api.admins.role);
  const admins = useQuery(api.admins.list, role === "owner" ? {} : "skip");
  const update = useMutation(api.settings.update);
  const addAdmin = useMutation(api.admins.add);
  const removeAdmin = useMutation(api.admins.remove);
  const [newColour, setNewColour] = useState("");
  const [maxMb, setMaxMb] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");

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
  const moveColour = (i: number, delta: number) => {
    const next = [...colours];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    void save({ colours: next }, "Palette reordered");
  };
  const currentMb = String(Math.round((settings.maxFileBytes / 1024 / 1024) * 10) / 10);

  return (
    <div className="flex flex-col gap-8">
      <Section title="Submissions" description="Close submissions when the printers are full or the event wraps up.">
        <label className="flex items-center gap-3 text-sm">
          <Checkbox
            checked={settings.submissionsOpen}
            onCheckedChange={(checked) =>
              save({ submissionsOpen: checked }, checked ? "Submissions opened" : "Submissions closed")
            }
          />
          Submissions open
        </label>
      </Section>
      <Separator />

      <Section title="Max file size" description="Uploads above this are refused.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
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
                onChange={(e) => setMaxMb(e.target.value)}
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
          {colours.map((c, i) => (
            <li key={c} className="flex min-h-11 items-center gap-3 px-1 py-1.5">
              <span
                aria-hidden
                className="size-4 rounded-full ring-1 ring-foreground/20"
                style={{ background: swatchFor(c) }}
              />
              <span className="flex-1 text-sm">{c}</span>
              <Button size="icon-sm" variant="ghost" aria-label={`Move ${c} up`} disabled={i === 0} onClick={() => moveColour(i, -1)}>
                <ArrowUp />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Move ${c} down`}
                disabled={i === colours.length - 1}
                onClick={() => moveColour(i, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${c}`}
                className="text-muted-foreground"
                onClick={() => save({ colours: colours.filter((x) => x !== c) }, `${c} removed`)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = newColour.trim();
            if (!name) return;
            if (colours.some((c) => c.toLowerCase() === name.toLowerCase())) {
              return toast.error(`${name} is already in the palette`);
            }
            void save({ colours: [...colours, name] }, `${name} added`);
            setNewColour("");
          }}
        >
          <Field className="max-w-sm">
            <FieldLabel htmlFor="new-colour">Add a colour</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="new-colour"
                value={newColour}
                onChange={(e) => setNewColour(e.target.value)}
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
      <Separator />

      <Section title="Staff" description="Staff can review, print and manage intake. Sign-in email must be verified.">
        {role === undefined ? (
          <Skeleton className="h-12 rounded-md" />
        ) : role === "owner" ? (
          <>
            <form
              className="mb-4"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await addAdmin({ email: adminEmail });
                  toast.success(`${adminEmail.trim().toLowerCase()} is now staff`);
                  setAdminEmail("");
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              <Field className="max-w-sm">
                <FieldLabel htmlFor="admin-email">Add staff</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="admin-email"
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="organizer@example.com"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton type="submit" variant="default" size="xs">
                      <UserPlus data-icon="inline-start" />
                      Add
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </form>
            {admins === undefined ? (
              <Skeleton className="h-12 rounded-md" />
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {admins.map((a) => (
                  <li key={a._id} className="flex min-h-11 items-center justify-between gap-3 px-1 py-1.5">
                    <span className="truncate text-sm">{a.email}</span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${a.email}`}
                      className="text-muted-foreground"
                      onClick={async () => {
                        try {
                          await removeAdmin({ id: a._id });
                          toast.success("Staff member removed");
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Only the event owner can manage staff accounts.</p>
        )}
      </Section>
    </div>
  );
}
