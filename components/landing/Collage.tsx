"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { COLLAGE, SLOTS_DESKTOP, SLOTS_MOBILE, type Slot } from "./data";

export default function Collage() {
  const section = useRef<HTMLElement>(null);
  const [slots, setSlots] = useState<Slot[]>(SLOTS_DESKTOP);

  useEffect(() => {
    const mq = matchMedia("(max-width: 900px)");
    const apply = () => setSlots(mq.matches ? SLOTS_MOBILE : SLOTS_DESKTOP);
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
    const photoElements = Array.from(sec.querySelectorAll<HTMLElement>(".dl-ph"));
    const tick = () => {
      raf = 0;
      const rect = sec.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(1, (innerHeight - rect.top) / (rect.height + innerHeight)),
      );
      photoElements.forEach((photo) => {
        const speed = Number(photo.dataset.speed);
        const offset = speed * 200 * (1 - 2 * progress);
        photo.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
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
  }, [slots]);

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
      {slots.map((slot, index) => {
        const photo = COLLAGE[index % COLLAGE.length];
        return (
          <div
            key={`${photo}-${index}`}
            className={`dl-ph${index % 7 === 3 ? " brown" : ""}`}
            data-speed={slot[2]}
            style={{
              left: `${slot[0]}%`,
              top: `${slot[1]}%`,
              ["--w" as string]: `${slot[3]}px`,
            }}
          >
            <Image
              src={`/landing/collage/${photo}-600.webp`}
              alt=""
              width={600}
              height={337}
              sizes="(max-width: 900px) 140px, 260px"
              loading="lazy"
              fetchPriority="low"
              unoptimized
            />
          </div>
        );
      })}
      <div className="fade" />
    </section>
  );
}
