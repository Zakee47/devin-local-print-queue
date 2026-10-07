"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SocialPost } from "./data";

const ICONS: Record<string, React.ReactNode> = {
  x: (
    <svg className="plat" viewBox="0 0 24 24" aria-label="X">
      <path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20z" />
    </svg>
  ),
  linkedin: (
    <svg className="plat" viewBox="0 0 24 24" aria-label="LinkedIn">
      <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5zM3 9h4v12H3zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4z" />
    </svg>
  ),
  instagram: (
    <svg className="plat" viewBox="0 0 24 24" aria-label="Instagram">
      <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM21.9 7.9c-.1-1.7-.5-3.2-1.7-4.4S17.8 1.9 16.1 1.8C14.4 1.7 9.6 1.7 7.9 1.8 6.2 1.9 4.7 2.3 3.5 3.5S1.9 6.2 1.8 7.9c-.1 1.7-.1 6.5 0 8.2.1 1.7.5 3.2 1.7 4.4s2.7 1.6 4.4 1.7c1.7.1 6.5.1 8.2 0 1.7-.1 3.2-.5 4.4-1.7s1.6-2.7 1.7-4.4c.1-1.7.1-6.5 0-8.2zM19.8 18c-.4.9-1.1 1.6-2 2-1.4.5-4.6.4-5.8.4s-4.4.1-5.8-.4c-.9-.4-1.6-1.1-2-2-.5-1.4-.4-4.6-.4-5.8s-.1-4.4.4-5.8c.4-.9 1.1-1.6 2-2C7.6 3.9 10.8 4 12 4s4.4-.1 5.8.4c.9.4 1.6 1.1 2 2 .5 1.4.4 4.6.4 5.8s.1 4.4-.4 5.8z" />
    </svg>
  ),
};

const MOBILE_INITIAL = 5;
const GAP = 18;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Post({ post, order, visible }: { post: SocialPost; order: number; visible: boolean }) {
  const media = post.media.slice(0, 4);
  const handle = post.author.handle
    ? `@${post.author.handle.replace(/^@/, "")}`
    : post.platform === "linkedin"
      ? "LinkedIn"
      : "";
  return (
    <a
      className={`dl-post${post.featured ? " featured" : ""}${visible ? " vis" : ""}`}
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      data-id={post.id}
      data-reveal
      style={{ order, ["--d" as string]: `${(order % 3) * 0.08}s` }}
    >
      <div className="top">
        <Image src={post.author.avatar} alt="" width={38} height={38} loading="lazy" unoptimized />
        <div className="who">
          <b>{post.author.name}</b>
          <span>{handle}</span>
        </div>
        {ICONS[post.platform] ?? null}
      </div>
      <p className="txt">{post.text}</p>
      {media.length ? (
        <div className={`media n${media.length}`}>
          {media.map((m, i) =>
            m.type === "video" ? (
              <video
                key={i}
                data-src={m.src}
                poster={m.poster}
                width={m.width ?? undefined}
                height={m.height ?? undefined}
                muted
                loop
                playsInline
                preload="none"
              />
            ) : (
              <Image
                key={i}
                src={m.src}
                alt={m.alt ?? ""}
                width={m.width ?? 800}
                height={m.height ?? 600}
                sizes="(max-width: 900px) 100vw, 400px"
                loading="lazy"
                unoptimized
              />
            )
          )}
        </div>
      ) : null}
      <div className="date">{formatDate(post.date)}</div>
    </a>
  );
}

// Three-column testimonial wall. Featured posts anchor the (wider) middle
// column; the rest are measured after mount and placed tallest-first into
// the shortest column so the three bottom edges stay level. On phones the
// columns collapse into one ordered list with a "Show more" button.
export default function SocialWall({ posts }: { posts: SocialPost[] }) {
  const wall = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => {
    const featured = posts
      .filter((p) => p.featured)
      .sort((a, b) => (a.featuredRank ?? 9) - (b.featuredRank ?? 9));
    const rest = posts.filter((p) => !p.featured);
    return [...featured, ...rest];
  }, [posts]);

  const initialColumns = useMemo(() => {
    const cols: SocialPost[][] = [[], [], []];
    const pattern = [0, 2, 1];
    let k = 0;
    for (const p of ordered) {
      if (p.featured) cols[1].push(p);
      else cols[pattern[k++ % 3]].push(p);
    }
    return cols;
  }, [ordered]);

  const [columns, setColumns] = useState(initialColumns);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const el = wall.current;
    if (!el) return;
    const balance = () => {
      if (innerWidth < 900) return;
      const heights = new Map<string, number>();
      el.querySelectorAll<HTMLElement>(".dl-post").forEach((card) => {
        heights.set(card.dataset.id ?? "", card.offsetHeight);
      });
      const cols: SocialPost[][] = [[], [], []];
      const totals = [0, 0, 0];
      const put = (p: SocialPost, i: number) => {
        cols[i].push(p);
        totals[i] += (heights.get(p.id) ?? 400) + GAP;
      };
      const shortest = () => totals.indexOf(Math.min(...totals));
      const featured = ordered.filter((p) => p.featured);
      const rest = ordered.filter((p) => !p.featured);
      featured.forEach((p, i) => put(p, i === 0 ? 1 : shortest()));
      [...rest]
        .sort((a, b) => (heights.get(b.id) ?? 0) - (heights.get(a.id) ?? 0))
        .forEach((p) => put(p, shortest()));
      setColumns((prev) => (JSON.stringify(prev) === JSON.stringify(cols) ? prev : cols));
    };
    balance();
    let t = 0;
    const later = () => {
      clearTimeout(t);
      t = window.setTimeout(balance, 120);
    };
    document.fonts?.ready.then(balance);
    addEventListener("load", balance);
    addEventListener("resize", later);
    return () => {
      clearTimeout(t);
      removeEventListener("load", balance);
      removeEventListener("resize", later);
    };
  }, [ordered]);

  // Inline videos only fetch and play while they're near the viewport.
  useEffect(() => {
    const el = wall.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const v = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            if (!v.src && v.dataset.src) v.src = v.dataset.src;
            v.muted = true;
            v.play().catch(() => undefined);
          } else if (v.src) {
            v.pause();
          }
        }
      },
      { rootMargin: "200px" }
    );
    el.querySelectorAll("video[data-src]").forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [columns]);

  const orderOf = new Map(ordered.map((p, i) => [p.id, i]));

  return (
    <>
      <div className="dl-cols" id="cols" ref={wall}>
        {columns.map((col, c) => (
          <div className="dl-col" key={c}>
            {col.map((p) => {
              const order = orderOf.get(p.id) ?? 0;
              return <Post key={p.id} post={p} order={order} visible={showAll || order < MOBILE_INITIAL} />;
            })}
          </div>
        ))}
      </div>
      {!showAll ? (
        <button className="dl-btn dl-btn-ink dl-more" type="button" onClick={() => setShowAll(true)}>
          Show more posts
        </button>
      ) : null}
    </>
  );
}
