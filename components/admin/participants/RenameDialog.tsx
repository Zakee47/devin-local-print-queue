"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ParticipantRow } from "./ParticipantsManager";
import { errorMessage } from "@/lib/errors";

export default function RenameDialog({
  participant,
  open,
  onOpenChange,
}: {
  participant: ParticipantRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {participant ? (
          <RenameForm
            key={participant._id}
            participant={participant}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  participant,
  onDone,
}: {
  participant: ParticipantRow;
  onDone: () => void;
}) {
  const rename = useMutation(api.accounts.renameParticipant);
  const [username, setUsername] = useState(participant.username);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await rename({ participantId: participant._id, username });
      toast.success(`Renamed to ${username.trim()}`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't rename"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Rename {participant.username}</DialogTitle>
        <DialogDescription>
          This changes their public username everywhere, including the TV and gallery.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="rename-username">Username</FieldLabel>
        <Input
          id="rename-username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !username.trim()}>
          Rename
        </Button>
      </DialogFooter>
    </form>
  );
}
