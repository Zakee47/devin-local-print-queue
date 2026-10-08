"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { SCATTER_DESKTOP, SCATTER_MOBILE, type Scatter } from "./data";

// Reduced motion and `?static` keep the closing photos still.
export default function Collage() {
  const section = useRef<HTMLElement>(null);
  const [track, setTrack] = useState<Scatter[]>(SCATTER_DESKTOP);

  useEffect(() => {
    const mq = matchMedia("(max-width: 900px)");
    const apply = () => setTrack(mq.matches ? SCATTER_MOBILE : SCATTER_DESKTOP);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const sec = section.current;
    const trackElement = sec?.querySelector<HTMLElement>(".track");
    if (!sec || !trackElement) return;
    const still =
      new URLSearchParams(location.search).has("static") ||
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    let raf = 0;
    let listening = false;
    let trackWidth = trackElement.getBoundingClientRect().width;
    const photoElements = Array.from(sec.querySelectorAll<HTMLElement>(".dl-ph"));
    const tick = () => {
      raf = 0;
      const rect = sec.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(1, (innerHeight - rect.top) / (rect.height + innerHeight)),
      );
      photoElements.forEach((photo) => {
        const range = Number(photo.dataset.range);
        const offset = range * (1 - 2 * progress) * (trackWidth / 100);
        photo.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onResize = () => {
      trackWidth = trackElement.getBoundingClientRect().width;
      onScroll();
    };
    const attach = () => {
      if (listening) return;
      listening = true;
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("resize", onResize);
      onScroll();
    };
    const detach = () => {
      if (!listening) return;
      listening = false;
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) attach();
      else detach();
    });
    observer.observe(sec);
    return () => {
      observer.disconnect();
      detach();
    };
  }, [track]);

  const mobile = track === SCATTER_MOBILE;
  const bottomPadding = mobile ? 8.33333 : 5.52047;
  const trackHeight =
    Math.max(...track.map((photo) => photo.y + (photo.w * 2) / 3)) + bottomPadding;

  return (
    <section className="dl-closing dl-dark" id="closing" data-tone="dark" ref={section}>
      <div className="center">
        <div className="copy">
          <h2 data-reveal>
            See you at
            <br />
            the next one
          </h2>
          <p className="sub" data-reveal style={{ ["--d" as string]: "0.1s" }}>
            Bigger, better, and closer than ever. Next stop: Devin Local near you.
          </p>
          <a
            className="dl-btn dl-btn-y"
            href="https://luma.com/Cognition-london"
            data-reveal
            style={{ ["--d" as string]: "0.2s" }}
          >
            Join our next event
          </a>
        </div>
      </div>
      <div
        className="track"
        aria-hidden="true"
        style={{ height: `${trackHeight}cqw` }}
      >
        {track.map((photo, index) => (
          <div
            key={photo.id}
            className={`dl-ph${index % 7 === 3 ? " brown" : ""}`}
            data-range={photo.range}
            style={{
              left: `${photo.x}%`,
              top: `${photo.y}cqw`,
              width: `${photo.w}cqw`,
            }}
          >
            <Image
              src={`/landing/collage/${photo.id}-600.webp`}
              alt=""
              width={600}
              height={400}
              sizes="(max-width: 900px) 150px, 260px"
              loading="lazy"
              fetchPriority="low"
              unoptimized
            />
          </div>
        ))}
      </div>
      <div className="fade" />
    </section>
  );
}
