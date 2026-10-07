"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { COLLAGE, SLOTS_DESKTOP, SLOTS_MOBILE, type Slot } from "./data";

// Closing section: 35 event photos scattered over a tall dark area. Each
// photo drifts at its own speed as you scroll past (the centre copy is
// sticky), which reads as depth. Reduced motion / `?static` disables the drift.
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
    const tick = () => {
      raf = 0;
      const progress = -sec.getBoundingClientRect().top;
      sec.querySelectorAll<HTMLElement>(".dl-ph").forEach((el) => {
        const speed = Number(el.dataset.speed);
        el.style.transform = `translateY(${(-progress * speed).toFixed(1)}px)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [slots]);

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
      {slots.map((s, i) => {
        const photo = COLLAGE[i % COLLAGE.length];
        return (
          <div
            key={`${photo}-${i}`}
            className={`dl-ph${i % 7 === 3 ? " brown" : ""}`}
            style={{ left: `${s[0]}%`, top: `${s[1]}%`, ["--w" as string]: `${s[3]}px` }}
            data-speed={s[2]}
          >
            <Image
              src={`/landing/collage/${photo}-600.webp`}
              alt=""
              width={600}
              height={337}
              sizes="(max-width: 900px) 140px, 260px"
              loading="lazy"
              unoptimized
            />
          </div>
        );
      })}
      <div className="fade" />
    </section>
  );
}
