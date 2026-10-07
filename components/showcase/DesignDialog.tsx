"use client";

import type { ShowcaseDesign } from "@/convex/tv";
import Swatch from "@/components/tv/Swatch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DesignDialog({
  design,
  onClose,
}: {
  design: ShowcaseDesign | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={design !== null} onOpenChange={(open) => !open && onClose()}>
      {design ? (
        <DialogContent
          className="sm:max-w-xl"
          finalFocus={(closeType) => closeType === "keyboard"}
        >
          <div className="aspect-square w-full overflow-hidden rounded-lg bg-surface">
            {design.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={design.previewUrl}
                alt={`${design.title} by ${design.displayName}`}
                decoding="async"
                className="size-full object-contain"
              />
            ) : (
              <div className="grid size-full place-items-center text-muted-foreground">
                <span className="text-sm">Preview unavailable</span>
              </div>
            )}
          </div>
          <DialogHeader className="gap-1">
            <p className="flex items-center gap-2 font-mono text-sm font-medium tracking-wider text-brand">
              {design.printCode}
              <Swatch colour={design.colour} className="size-3.5" />
            </p>
            <DialogTitle className="text-xl sm:text-2xl">{design.title}</DialogTitle>
            <DialogDescription>by {design.displayName}</DialogDescription>
            {design.rank !== null ? (
              <p className="mt-2 font-mono text-sm text-muted-foreground">
                #{design.rank} · {design.votes} {design.votes === 1 ? "vote" : "votes"} · {design.likes}{" "}
                {design.likes === 1 ? "like" : "likes"}
              </p>
            ) : null}
          </DialogHeader>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
