import { Ban, Check, RotateCcw } from "lucide-react";
import { STATUS_LABELS, type SubmissionStatus } from "@/lib/event";
import { cn } from "@/lib/utils";

const STEPS = ["submitted", "queued", "printing", "done"] as const;

export default function StatusStepper({
  status,
  rejectionReason,
  rejectionKind,
  queuePosition,
}: {
  status: SubmissionStatus;
  rejectionReason?: string;
  rejectionKind?: "review" | "print_failed";
  queuePosition: number | null;
}) {
  if (status === "rejected" && rejectionKind === "print_failed") {
    const reason = rejectionReason?.trim().replace(/[.!?]+$/, "");
    return (
      <div role="status" className="rounded-lg border border-brand/50 bg-brand/10 p-4">
        <p className="flex items-center gap-2 font-medium text-brand">
          <RotateCcw className="size-4" aria-hidden="true" />
          Print failed
        </p>
        <p className="mt-1.5 text-sm text-foreground">
          {reason ? `The print failed: ${reason}.` : "The print failed."} Please upload a fixed version.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">This frees a slot, so you can upload another design.</p>
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div role="status" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
        <p className="flex items-center gap-2 font-medium">
          <Ban className="size-4" aria-hidden="true" />
          {STATUS_LABELS.rejected}
        </p>
        <p className="mt-1.5 text-sm text-foreground">
          {rejectionReason || "The organizers couldn't print this one."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">This frees a slot, so you can upload another design.</p>
      </div>
    );
  }
  const current = STEPS.indexOf(status);
  return (
    <div role="status" aria-label={`Status: ${STATUS_LABELS[status]}`}>
      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((step, i) => {
          const reached = i <= current;
          const active = i === current;
          return (
            <li key={step} className="flex flex-col gap-1.5">
              <span
                className={cn(
                  "h-1.5 rounded-full bg-muted",
                  reached && "bg-brand",
                  active && step !== "done" && "animate-pulse"
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1 text-[11px] leading-tight text-muted-dim sm:text-xs",
                  reached && "text-foreground",
                  active && "font-medium"
                )}
                aria-current={active ? "step" : undefined}
              >
                {i < current || (step === "done" && active) ? <Check className="size-3 shrink-0" aria-hidden="true" /> : null}
                {STATUS_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
      {status === "queued" && queuePosition !== null ? (
        <p className="mt-3 text-sm">
          <span className="font-mono text-lg font-semibold">#{queuePosition}</span>{" "}
          <span className="text-muted-foreground">in the print queue</span>
        </p>
      ) : status === "printing" ? (
        <p className="mt-3 text-sm text-muted-foreground">On the printer now.</p>
      ) : status === "done" ? (
        <p className="mt-3 text-sm text-muted-foreground">Printed. Nice work!</p>
      ) : null}
    </div>
  );
}
