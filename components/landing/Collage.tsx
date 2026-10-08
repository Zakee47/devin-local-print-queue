"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { LANES_DESKTOP, LANES_MOBILE, type Lane } from "./data";

// Reduced motion and `?static` keep the closing photos still.
export default function Collage() {
  const section = useRef<HTMLElement>(null);
  const [lanes, setLanes] = useState<Lane[]>(LANES_DESKTOP);

  useEffect(() => {
    const mq = matchMedia("(max-width: 900px)");
    const apply = () => setLanes(mq.matches ? LANES_MOBILE : LANES_DESKTOP);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const sec = section.current;
    if (!sec) return;
    const still =
      new URLSearchParams(location.search).has("static") ||
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    let raf = 0;
    let listening = false;
    const laneElements = Array.from(sec.querySelectorAll<HTMLElement>(".lane"));
    const tick = () => {
      raf = 0;
      const rect = sec.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(1, (innerHeight - rect.top) / (rect.height + innerHeight)),
      );
      laneElements.forEach((lane) => {
        const range = Number(lane.dataset.range);
        const offset = range * (1 - 2 * progress);
        lane.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const attach = () => {
      if (listening) return;
      listening = true;
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("resize", onScroll);
      onScroll();
    };
    const detach = () => {
      if (!listening) return;
      listening = false;
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
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
  }, [lanes]);

  return (
    <section className="dl-closing dl-dark" id="closing" data-tone="dark" ref={section}>
      <div className="center">
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
      <div
        className="track"
        aria-hidden="true"
        style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}
      >
        {lanes.map((lane, laneIndex) => (
          <div
            key={laneIndex}
            className="lane"
            data-range={lane.range}
            style={{ paddingTop: `${lane.pad}vh`, gap: `${lane.gap}vh` }}
          >
            {lane.photos.map((photo, photoIndex) => {
              const globalIndex =
                lanes
                  .slice(0, laneIndex)
                  .reduce((count, previousLane) => count + previousLane.photos.length, 0) +
                photoIndex;
              return (
                <div
                  key={photo.id}
                  className={`dl-ph${globalIndex % 7 === 3 ? " brown" : ""}`}
                  style={{ width: `${photo.scale}%`, alignSelf: photo.align }}
                >
                  <Image
                    src={`/landing/collage/${photo.id}-600.webp`}
                    alt=""
                    width={600}
                    height={337}
                    sizes="(max-width: 900px) 130px, 220px"
                    loading="lazy"
                    fetchPriority="low"
                    unoptimized
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="fade" />
    </section>
  );
}
