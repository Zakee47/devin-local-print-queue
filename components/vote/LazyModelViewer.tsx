"use client";

import { useEffect, useRef, useState } from "react";
import { Box } from "lucide-react";
import ModelViewer from "@/components/ModelViewer";
import { cn } from "@/lib/utils";

// Mounts the WebGL viewer only while the card is near the viewport (browsers
// cap live WebGL contexts), or once tapped when IntersectionObserver is absent.
export default function LazyModelViewer({
  url,
  kind,
  colour,
  className,
}: {
  url: string | null;
  kind: "stl" | "3mf";
  colour: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [tapped, setTapped] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const show = url && (inView || tapped);

  return (
    <div ref={ref} className={cn("relative aspect-square w-full bg-surface", className)}>
      {show ? (
        <ModelViewer url={url} kind={kind} colour={colour} className="absolute inset-0" />
      ) : (
        <button
          type="button"
          onClick={() => setTapped(true)}
          disabled={!url}
          className="absolute inset-0 grid place-items-center text-muted-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
          aria-label="Load 3D preview"
        >
          <span className="flex flex-col items-center gap-2 text-xs">
            <Box className="size-6" style={{ color: colour }} aria-hidden />
            {url ? "Tap to preview" : "Preview unavailable"}
          </span>
        </button>
      )}
    </div>
  );
}
