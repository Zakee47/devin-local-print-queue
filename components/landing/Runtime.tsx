"use client";

import { useEffect } from "react";

// Marks the landing root as JS-enabled (so reveal targets may start hidden),
// honours `?static` / reduced motion, and reveals `[data-reveal]` elements
// as they scroll into view. A MutationObserver picks up cards the social
// wall re-parents when it re-balances its columns.
export default function Runtime() {
  useEffect(() => {
    const root = document.getElementById("dl-root");
    if (!root) return;
    const params = new URLSearchParams(location.search);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isStatic = params.has("static") || reduce;
    root.classList.add("js");
    if (isStatic) root.classList.add("static");

    const targets = () => Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (isStatic || !("IntersectionObserver" in window)) {
      const show = () => targets().forEach((el) => el.classList.add("in"));
      show();
      const mo = new MutationObserver(show);
      mo.observe(root, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    const observe = () =>
      targets().forEach((el) => {
        if (!el.classList.contains("in")) io.observe(el);
      });
    observe();
    const mo = new MutationObserver(observe);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
