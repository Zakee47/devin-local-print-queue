"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const SESSION_KEY = "dl-loaded";
const MAX_MS = 4500;

const noop = () => () => {};
const shouldSkip = () => {
  const params = new URLSearchParams(location.search);
  return (
    params.has("noloader") ||
    params.has("static") ||
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    matchMedia("(max-width: 899px)").matches ||
    sessionStorage.getItem(SESSION_KEY) !== null
  );
};
const startHero = () => document.getElementById("top")?.classList.add("go");

// Full-screen intro (Cognition · otter · Devin) that plays once per tab on
// desktop and then fades into the hero. Phones skip it (CSS hides it too, so
// it never paints there). When it finishes, or is skipped, the hero gets its
// `go` class and starts its own entrance.
export default function Loader() {
  // Server renders the loader; the client decides on hydration whether to keep it.
  const skip = useSyncExternalStore(noop, shouldSkip, () => false);
  const [state, setState] = useState<"playing" | "out" | "gone">("playing");
  const videoRef = useRef<HTMLVideoElement>(null);
  const finished = useRef(false);

  const done = () => {
    if (finished.current) return;
    finished.current = true;
    sessionStorage.setItem(SESSION_KEY, "1");
    setState("out");
    startHero();
    setTimeout(() => setState("gone"), 500);
  };

  useEffect(() => {
    if (skip) {
      startHero();
      return;
    }
    videoRef.current?.play().catch(() => undefined);
    const t = setTimeout(done, MAX_MS);
    return () => clearTimeout(t);
  }, [skip]);

  if (skip || state === "gone") return null;
  return (
    <div className={`dl-loader${state === "out" ? " out" : ""}`} aria-hidden="true">
      <video
        ref={videoRef}
        src="/landing/loader.mp4"
        poster="/landing/loader-frame.jpg"
        muted
        playsInline
        preload="auto"
        onEnded={done}
      />
      <button type="button" tabIndex={-1} onClick={done}>
        Skip
      </button>
    </div>
  );
}
