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

const REVIEW_REASONS = [
  "Too large, over the max size",
  "Not a keychain / no ring hole",
  "Mesh errors, please re-export",
  "Walls too thin",
];

const PRINT_FAILED_REASONS = [
  "Detached from the bed",
  "Failed mid-print",
  "Thin parts broke, please thicken them",
];

export default function RejectDialog({
  submissionId,
  printCode,
  open,
  onOpenChange,
  kind,
  designEntry,
}: {
  submissionId: Id<"submissions">;
  printCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "review" | "print_failed";
  designEntry: boolean;
}) {
  const reject = useMutation(api.queue.reject);
  const printFailed = useMutation(api.queue.printFailed);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const isPrintFailed = kind === "print_failed";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isPrintFailed) {
        await printFailed({ id: submissionId, reason });
        toast.success(`${printCode} marked as failed`);
      } else {
        await reject({ id: submissionId, reason });
        toast.success(`${printCode} rejected`);
      }
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
            <DialogTitle>{isPrintFailed ? "Print failed" : "Reject"} {printCode}</DialogTitle>
            <DialogDescription>
              {isPrintFailed
                ? "The participant sees this reason and can submit again."
                : "The participant sees this comment and can upload a fixed file."}{" "}
              This only affects printing.
              {designEntry
                ? " The design stays in the competition and keeps its votes. Use Remove from competition to pull it from voting."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {(isPrintFailed ? PRINT_FAILED_REASONS : REVIEW_REASONS).map((r) => (
              <Button key={r} type="button" variant="outline" size="xs" onClick={() => setReason(r)}>
                {r}
              </Button>
            ))}
          </div>
          <Field>
            <FieldLabel htmlFor={`reject-${submissionId}`}>
              {isPrintFailed ? "Reason (required)" : "Comment (required)"}
            </FieldLabel>
            <Textarea
              id={`reject-${submissionId}`}
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isPrintFailed ? "What went wrong with the print?" : "What should they change?"}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={saving || !reason.trim()}>
              {isPrintFailed ? "Mark failed" : "Reject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
