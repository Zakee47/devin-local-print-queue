"use client";

import { useEffect, useRef } from "react";

// Muted, looping background video. It pauses whenever the hero is fully
// scrolled out of view and resumes when it comes back, so it doesn't keep
// decoding while people read the rest of the page.
export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const play = () => v.play().catch(() => undefined);
    play();
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play();
        else v.pause();
      },
      { threshold: 0 }
    );
    io.observe(v);
    const onVisibility = () => (document.hidden ? v.pause() : play());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return (
    <video
      ref={ref}
      poster="/landing/hero-poster.jpg"
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      aria-hidden="true"
    >
      <source src="/landing/hero.mp4" media="(min-width: 900px)" type="video/mp4" />
      <source src="/landing/hero-720.mp4" type="video/mp4" />
    </video>
  );
}
