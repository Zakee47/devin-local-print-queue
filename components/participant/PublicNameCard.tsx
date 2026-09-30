"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { normalizeUsername, USERNAME_MAX, validateUsername } from "@/lib/usernames";

function errorMessage(e: unknown) {
  if (!(e instanceof Error)) return "Couldn't save your username";
  const match = e.message.match(/Uncaught Error: (.+?)(\n|$)/);
  return match ? match[1] : e.message;
}

export default function PublicNameCard({ username }: { username: string }) {
  const setUsername = useMutation(api.participants.setUsername);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(username);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const validationError = validateUsername(value);
  const unchanged = normalizeUsername(value) === username;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError || unchanged) return;
    setSaving(true);
    setServerError(null);
    try {
      await setUsername({ username: value });
      toast.success("Username updated");
      setOpen(false);
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <p className="min-w-0 truncate text-sm text-muted-foreground">
        Your public name: <span className="font-medium text-foreground">{username}</span>
      </p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setValue(username);
            setServerError(null);
          }
        }}
      >
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>
          <Pencil data-icon="inline-start" />
          Edit
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Change your public name</DialogTitle>
              <DialogDescription>Shown on the TV, the gallery and the vote deck.</DialogDescription>
            </DialogHeader>
            <Field data-invalid={Boolean(validationError || serverError) || undefined}>
              <FieldLabel htmlFor="public-username">Username</FieldLabel>
              <Input
                id="public-username"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setServerError(null);
                }}
                maxLength={USERNAME_MAX + 8}
                autoComplete="nickname"
                aria-invalid={Boolean(validationError || serverError) || undefined}
                className="h-10 text-base sm:h-9 sm:text-sm"
              />
              {validationError || serverError ? (
                <FieldError>{validationError ?? serverError}</FieldError>
              ) : (
                <FieldDescription>Letters, numbers, spaces and . _ &apos; -</FieldDescription>
              )}
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={saving || Boolean(validationError) || unchanged}>
                {saving ? <Spinner data-icon="inline-start" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
