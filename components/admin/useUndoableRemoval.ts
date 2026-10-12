"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

export const UNDO_WINDOW_MS = 15_000;

type ScheduledRemoval = {
  timeout: ReturnType<typeof setTimeout> | null;
};

export function useUndoableRemoval(): {
  pending: ReadonlySet<string>;
  schedule: (opts: {
    id: string;
    label: string;
    run: () => Promise<unknown>;
    errorFallback: string;
  }) => void;
} {
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ScheduledRemoval>());

  useEffect(() => {
    if (pending.size === 0) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [pending]);

  function removePending(id: string) {
    setPending((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function schedule({
    id,
    label,
    run,
    errorFallback,
  }: {
    id: string;
    label: string;
    run: () => Promise<unknown>;
    errorFallback: string;
  }) {
    if (timers.current.has(id)) return;

    setPending((current) => new Set(current).add(id));

    const toastId = `undoable-removal:${id}`;
    const scheduled: ScheduledRemoval = { timeout: null };

    const undo = () => {
      if (timers.current.get(id) !== scheduled || scheduled.timeout === null) return;
      clearTimeout(scheduled.timeout);
      timers.current.delete(id);
      removePending(id);
      toast.dismiss(toastId);
      toast.success(`${label} restored`);
    };

    timers.current.set(id, scheduled);
    scheduled.timeout = setTimeout(() => {
      if (timers.current.get(id) !== scheduled) return;
      scheduled.timeout = null;
      toast.dismiss(toastId);

      void (async () => {
        try {
          await run();
        } catch (err) {
          toast.error(errorMessage(err, errorFallback));
        } finally {
          if (timers.current.get(id) === scheduled) {
            timers.current.delete(id);
            removePending(id);
          }
        }
      })();
    }, UNDO_WINDOW_MS);

    toast(`${label} removed`, {
      id: toastId,
      description: "Permanent in 15 seconds",
      duration: UNDO_WINDOW_MS,
      action: { label: "Undo", onClick: undo },
    });
  }

  return { pending, schedule };
}
