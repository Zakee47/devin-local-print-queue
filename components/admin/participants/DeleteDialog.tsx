"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ParticipantRow } from "./ParticipantsManager";

export default function DeleteDialog({
  participant,
  open,
  onOpenChange,
}: {
  participant: ParticipantRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteParticipant = useMutation(api.accounts.deleteParticipant);
  const [block, setBlock] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setBlock(false);
      setReason("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!participant) return;
    setSaving(true);
    try {
      await deleteParticipant({
        participantId: participant._id,
        block,
        reason: reason.trim() || undefined,
      });
      toast.success(
        `${participant.username} deleted${block ? " and blocked" : ""}`
      );
      close(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Delete {participant?.username}?</DialogTitle>
            <DialogDescription>
              This deletes their submissions and files, votes and likes. Their Clerk
              sign-in remains, but they will no longer have a participant account.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={block}
                onCheckedChange={(checked) => setBlock(checked === true)}
              />
              Also block this email from signing up again
            </label>
          </Field>
          {block ? (
            <Field>
              <FieldLabel htmlFor="block-reason">Reason (optional)</FieldLabel>
              <Textarea
                id="block-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Only visible to the owner"
              />
            </Field>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              Delete participant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
