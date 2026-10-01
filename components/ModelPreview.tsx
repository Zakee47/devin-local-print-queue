"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Box, Rotate3d } from "lucide-react";
import type { FileKind } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), { ssr: false });

export default function ModelPreview({
  url,
  previewUrl,
  kind,
  colour,
  alt,
  className,
}: {
  url: string | null;
  previewUrl: string | null;
  kind: FileKind;
  colour: string;
  alt: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setShow3d(false);
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("relative aspect-square w-full bg-surface", className)}>
      {show3d && url ? (
        <ModelViewer url={url} kind={kind} colour={colour} className="absolute inset-0" />
      ) : previewUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 size-full object-contain"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!url}
            onClick={() => setShow3d(true)}
            className="pointer-events-auto absolute right-2 bottom-2"
          >
            <Rotate3d data-icon="inline-start" />
            View in 3D
          </Button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShow3d(true)}
          disabled={!url}
          aria-label={url ? `Load 3D preview of ${alt}` : "Preview unavailable"}
          className="pointer-events-auto absolute inset-0 grid place-items-center text-muted-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
        >
          <span className="flex flex-col items-center gap-2 text-xs">
            <Box className="size-6" style={{ color: colour }} aria-hidden />
            {url ? "Tap to load 3D" : "Preview unavailable"}
          </span>
        </button>
      )}
    </div>
  );
}
