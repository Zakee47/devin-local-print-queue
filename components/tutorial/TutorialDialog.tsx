"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { TOURS, type Tour } from "@/lib/tutorials";
import TutorialArt from "./TutorialArt";

export default function TutorialDialog({
  tour,
  open,
  onClose,
}: {
  tour: Tour;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const slides = TOURS[tour];
  const slide = slides[step];
  const last = step === slides.length - 1;

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (!last) setStep((current) => current + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (step > 0) setStep((current) => current - 1);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) setStep(0);
      }}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={primaryRef}
        finalFocus={(closeType) => closeType === "keyboard"}
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
        onKeyDown={onKeyDown}
      >
        <div className="aspect-[16/10] border-b border-border bg-muted/40 bg-dotgrid">
          <div key={step} className="h-full animate-in fade-in-0 slide-in-from-right-2 motion-reduce:animate-none">
            <div aria-hidden="true" className="h-full">
              <TutorialArt art={slide.art} />
            </div>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto p-5">
          <p className="eyebrow text-muted-dim">
            Step {step + 1} of {slides.length}
          </p>
          <DialogTitle className="mt-2 text-lg leading-snug">{slide.title}</DialogTitle>
          <DialogDescription className="mt-2 leading-relaxed">{slide.body}</DialogDescription>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
          <div className="order-first flex w-full items-center gap-1 sm:order-none sm:w-auto">
            {slides.map((item, index) => (
              <button
                key={item.art}
                type="button"
                aria-label={`Go to step ${index + 1}`}
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
                className="grid size-7 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                <span
                  className={`h-1.5 rounded-full transition-[width,background-color] ${
                    index === step ? "w-4 bg-brand" : "w-1.5 bg-border-strong"
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            {!last ? (
              <Button variant="link" size="sm" onClick={onClose}>
                Skip
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
              Back
            </Button>
            <Button
              ref={primaryRef}
              size="sm"
              onClick={last ? onClose : () => setStep((current) => Math.min(slides.length - 1, current + 1))}
            >
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
