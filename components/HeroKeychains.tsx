"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState, useSyncExternalStore } from "react";
import { swatchFor } from "@/lib/colours";
import { cn } from "@/lib/utils";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), { ssr: false });

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true
  );
}

// Waits for an idle moment after hydration so the viewers (three.js + models)
// never compete with first paint or the sign-in button.
function useIdleMount() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setReady(true), 300);
    return () => window.clearTimeout(id);
  }, []);
  return ready;
}

// Decorative pair of spinning keychains for the home hero: the Devin mascot in
// orange in front, the Cognition logo in black behind it.
export default function HeroKeychains({ className }: { className?: string }) {
  const ready = useIdleMount();
  const reducedMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();

  return (
    <div aria-hidden className={cn("pointer-events-none relative select-none", className)}>
      <div className="absolute top-0 left-[40%] aspect-square h-[82%] lg:top-[2%] lg:left-[40%] lg:h-auto lg:w-[52%]">
        {ready ? (
          <ModelViewer
            url="/models/cognition-keychain.stl"
            kind="stl"
            colour={swatchFor("black")}
            autoRotate={!reducedMotion}
            boostLighting={resolvedTheme === "dark"}
            fallback={null}
            className="absolute inset-0 aspect-auto h-full"
          />
        ) : null}
      </div>
      <div className="absolute bottom-0 left-0 aspect-square h-full lg:left-[6%] lg:h-auto lg:w-[76%]">
        {ready ? (
          <ModelViewer
            url="/models/devin-mascot-keychain.stl"
            kind="stl"
            colour={swatchFor("orange")}
            autoRotate={!reducedMotion}
            fallback={null}
            className="absolute inset-0 aspect-auto h-full"
          />
        ) : null}
      </div>
    </div>
  );
}
