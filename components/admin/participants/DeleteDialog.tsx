"use client";

import { useState } from "react";
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
  onConfirm,
}: {
  participant: ParticipantRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (args: { block: boolean; reason?: string }) => void;
}) {
  const [block, setBlock] = useState(false);
  const [reason, setReason] = useState("");

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setBlock(false);
      setReason("");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!participant) return;
    onConfirm({ block, reason: reason.trim() || undefined });
    close(false);
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
              {" "}You&apos;ll have 15 seconds to undo.
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
            <Button type="submit" variant="destructive">
              Delete participant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
