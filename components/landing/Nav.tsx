"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LUMA_CALENDAR, NAV_ITEMS } from "./data";
import { CognitionLogo, DevinLogo } from "./Logos";

type Tone = "hero" | "cream" | "sand" | "dark";

// Fixed banner that is transparent over the hero video, then picks up a
// translucent tint matching whichever section it floats over (sections
// declare `data-tone`). The menu button opens a right-hand drawer with the
// section links and the main CTA.
export default function Nav() {
  const [tone, setTone] = useState<Tone>("hero");
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const zones = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-tone]")).map(
        (el) => [el.offsetTop + Number(el.dataset.toneOffset ?? 0), el.dataset.tone as Tone] as const
      );
    let list = zones();
    const tick = () => {
      const y = scrollY + 36;
      let t: Tone = "hero";
      for (const [top, zone] of list) if (y >= top) t = zone;
      setTone(t);
    };
    const onResize = () => {
      list = zones();
      tick();
    };
    tick();
    addEventListener("scroll", tick, { passive: true });
    addEventListener("resize", onResize);
    addEventListener("load", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    return () => {
      removeEventListener("scroll", tick);
      removeEventListener("resize", onResize);
      removeEventListener("load", onResize);
      ro.disconnect();
    };
  }, []);

  const set = useCallback((o: boolean) => {
    setOpen(o);
    document.documentElement.style.overflow = o ? "hidden" : "";
    requestAnimationFrame(() => {
      if (o) closeBtn.current?.focus();
      else menuBtn.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        set(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, set]);

  const navClass =
    "dl-nav" + (tone === "hero" ? "" : ` scrolled tone-${tone}${tone === "dark" ? "" : " lite"}`);

  return (
    <>
      <header className={navClass} id="nav">
        <div className="dl-wrap">
          <a className="dl-brand" href="#top" aria-label="Devin Local home">
            <CognitionLogo className="dl-logo" />
            <span className="x" />
            <DevinLogo className="dl-logo" />
          </a>
          <button
            ref={menuBtn}
            className="dl-menubtn"
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="drawer"
            onClick={() => set(true)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>
      <div className={`dl-drawer${open ? " open" : ""}`} id="drawer" aria-hidden={!open} inert={!open}>
        <div className="scrim" onClick={() => set(false)} />
        <aside ref={panelRef} className="panel" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="phead">
            <span className="dl-brand">
              <CognitionLogo className="dl-logo" />
              <span className="x" />
              <DevinLogo className="dl-logo" />
            </span>
            <button ref={closeBtn} className="close" type="button" aria-label="Close menu" onClick={() => set(false)}>
              &times;
            </button>
          </div>
          <nav>
            {NAV_ITEMS.map((item, i) => (
              <a key={item.href} href={item.href} onClick={() => set(false)}>
                <small>{String(i + 1).padStart(2, "0")}</small>
                {item.label}
              </a>
            ))}
          </nav>
          <a className="dl-btn dl-btn-y" href={LUMA_CALENDAR} onClick={() => set(false)}>
            Join our next event
          </a>
        </aside>
      </div>
    </>
  );
}
