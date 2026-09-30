"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { Textarea } from "@/components/ui/textarea";

export const QUICK_REASONS = [
  "Too large for the bed / exceeds 60mm",
  "Not a keychain / no ring hole",
  "Mesh errors, please re-export",
  "Walls too thin",
];

export default function RejectDialog({
  submissionId,
  printCode,
  open,
  onOpenChange,
}: {
  submissionId: Id<"submissions">;
  printCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reject = useMutation(api.queue.reject);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await reject({ id: submissionId, reason });
      toast.success(`${printCode} rejected`);
      setReason("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reject");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Reject {printCode}</DialogTitle>
            <DialogDescription>
              The participant sees this comment and can upload a fixed file.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((r) => (
              <Button key={r} type="button" variant="outline" size="xs" onClick={() => setReason(r)}>
                {r}
              </Button>
            ))}
          </div>
          <Field>
            <FieldLabel htmlFor={`reject-${submissionId}`}>Comment (required)</FieldLabel>
            <Textarea
              id={`reject-${submissionId}`}
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What should they change?"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={saving || !reason.trim()}>
              Reject
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
