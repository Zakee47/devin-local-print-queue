"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Heart } from "lucide-react";
import type { TvRanked } from "@/convex/tv";
import type { MyStanding } from "@/convex/votes";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import Swatch from "@/components/tv/Swatch";
import { useRankMotion } from "./useRankMotion";

export default function LiveLeaderboard({
  rows,
  totalVotes,
  totalLikes,
  variant,
  votingOpen,
  votingNotOpenYet,
  mine,
  onSelect,
  mineDisplayName,
  scrollable = false,
  className,
}: {
  rows: TvRanked[];
  totalVotes: number;
  totalLikes: number;
  variant: "tv" | "page";
  votingOpen?: boolean;
  votingNotOpenYet?: boolean;
  mine?: MyStanding;
  onSelect?: (printCode: string) => void;
  mineDisplayName?: string;
  scrollable?: boolean;
  className?: string;
}) {
  const { register, changes } = useRankMotion(rows);
  const topVotes = Math.max(1, ...rows.map((row) => row.votes));
  const tv = variant === "tv";
  const myEntry = mine?.entries[0];
  const myEntryIsVisible =
    mine?.entries.some((entry) => rows.some((row) => row.printCode === entry.printCode)) ?? false;
  const pinnedEntry = myEntry && !myEntryIsVisible ? myEntry : null;

  return (
    <section
      aria-labelledby="leaderboard-heading"
      className={cn("min-h-0", tv && "h-full", className)}
    >
      <Card
        className={cn(
          "h-full min-h-0 gap-0 border border-border ring-0 shadow-none",
          tv ? "rounded-2xl px-6 py-4" : "rounded-xl px-4 py-5 sm:px-6",
          scrollable && "overflow-hidden max-lg:overflow-visible"
        )}
      >
        <header className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", tv ? "mb-3" : "mb-5")}>
          <div className="min-w-0">
            <h2
              id="leaderboard-heading"
              className={cn("font-heading font-semibold tracking-[-0.02em]", tv ? "text-2xl" : "text-xl sm:text-2xl")}
            >
              Live leaderboard
            </h2>
            <p className={cn("mt-1 text-muted-foreground", tv ? "text-lg" : "text-xs sm:text-sm")}>
              Ranked by votes · likes break ties
            </p>
          </div>
          <div className={cn("flex shrink-0 flex-col", tv ? "items-end gap-2" : "gap-1 sm:items-end")}>
            <p className={cn("flex items-center gap-2 font-mono font-medium", tv ? "text-lg" : "text-xs")}>
              {votingNotOpenYet ? (
                <span className="text-muted-foreground">Voting opens soon</span>
              ) : votingOpen === false ? (
                <span className="text-muted-foreground">Voting closed</span>
              ) : (
                <>
                  <span
                    className={cn("rounded-full bg-brand animate-brand-pulse", tv ? "size-3" : "size-2")}
                    aria-hidden="true"
                  />
                  <span>Live</span>
                </>
              )}
            </p>
            <p className={cn("font-mono tabular-nums text-muted-foreground", tv ? "text-xl" : "text-xs sm:text-sm")}>
              {totalVotes} votes · {totalLikes} likes
            </p>
          </div>
        </header>
        {rows.length === 0 ? (
          <p className={cn("text-muted-foreground", tv ? "mt-6 text-xl" : "text-sm")}>
            No votes yet. Swipe and vote at{" "}
            {variant === "page" ? (
              <Link className="text-link underline underline-offset-2" href="/vote">
                /vote
              </Link>
            ) : (
              "/vote"
            )}
            .
          </p>
        ) : (
          <ol
            className={cn(
              "flex min-h-0 flex-col",
              tv && "overflow-hidden",
              scrollable &&
                "flex-1 overflow-y-auto lg:overscroll-contain max-lg:flex-none max-lg:max-h-[19.5rem]"
            )}
          >
            {rows.map((row) => {
              const change = changes.get(row.printCode);
              const barWidth = `${(row.votes / topVotes) * 100}%`;
              const isMine = mine?.entries.some((entry) => entry.printCode === row.printCode) ?? false;
              return (
                <li
                  key={row.printCode}
                  ref={register(row.printCode)}
                  className={cn(
                    "relative flex shrink-0 items-center border-b border-border/70 last:border-0",
                    tv ? "h-[64px] gap-4 px-3" : "h-14 gap-2 px-1 sm:gap-3 sm:px-2",
                    change?.votesDelta && change.votesDelta > 0 && "rank-flash",
                    change?.isNew && "animate-in fade-in slide-in-from-bottom-3",
                    isMine && "z-10 rounded-lg bg-brand/5 ring-2 ring-brand/70"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-1 left-0 rounded-md bg-brand/10 transition-[width] duration-700"
                    style={{ width: barWidth }}
                  />
                  <span
                    className={cn(
                      "relative z-10 grid shrink-0 place-items-center rounded-full font-mono font-semibold tabular-nums",
                      tv ? "size-9 text-lg" : "size-7 text-xs",
                      row.rank === 1
                        ? "bg-brand text-brand-foreground"
                        : "border border-border bg-background text-muted-foreground"
                    )}
                  >
                    {row.rank}
                  </span>
                  <Swatch colour={row.colour} className={tv ? "relative z-10 size-6" : "relative z-10 size-4"} />
                  <div className="relative z-10 min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className={cn("min-w-0 truncate font-medium", tv ? "text-2xl" : "text-base")}>{row.title}</p>
                      {isMine ? (
                        <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.6rem] leading-none font-semibold text-brand-foreground">
                          You
                        </span>
                      ) : null}
                    </div>
                    <p className={cn("truncate text-muted-foreground", tv ? "text-base" : "text-xs")}>
                      {row.displayName}
                    </p>
                  </div>
                  {change?.moved ? (
                    <span
                      className={cn(
                        "relative z-10 flex shrink-0 items-center gap-0.5 font-mono animate-in fade-in zoom-in",
                        tv ? "text-lg" : "text-xs",
                        change.moved > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      )}
                      aria-label={`${Math.abs(change.moved)} places ${change.moved > 0 ? "up" : "down"}`}
                    >
                      {change.moved > 0 ? (
                        <ArrowUp className={tv ? "size-5" : "size-3"} aria-hidden="true" />
                      ) : (
                        <ArrowDown className={tv ? "size-5" : "size-3"} aria-hidden="true" />
                      )}
                      {Math.abs(change.moved)}
                    </span>
                  ) : null}
                  {change && change.votesDelta > 0 ? (
                    <span
                      className={cn(
                        "relative z-10 rounded-full bg-brand py-0.5 font-mono font-semibold text-brand-foreground animate-in fade-in zoom-in",
                        tv ? "px-3 text-lg" : "px-2 text-xs"
                      )}
                    >
                      +{change.votesDelta}
                    </span>
                  ) : null}
                  <span className={cn("relative z-10 flex shrink-0 items-center gap-1 font-mono tabular-nums", tv ? "text-lg" : "text-xs")}>
                    <Heart
                      className={cn("text-brand", tv ? "size-5" : "size-4", change && change.likesDelta > 0 && "heart-pop")}
                      aria-hidden="true"
                    />
                    {row.likes}
                  </span>
                  <span className="relative z-10 flex shrink-0 items-baseline gap-1">
                    <span className={cn("font-mono font-bold tabular-nums", tv ? "text-4xl" : "text-xl")}>
                      {row.votes}
                    </span>
                    <span
                      className={cn(
                        "text-muted-foreground",
                        tv ? "text-base" : "hidden text-[0.65rem] sm:inline"
                      )}
                    >
                      {row.votes === 1 ? "vote" : "votes"}
                    </span>
                  </span>
                  {onSelect ? (
                    <button
                      type="button"
                      aria-label={`View ${row.title} by ${row.displayName}`}
                      onClick={() => onSelect(row.printCode)}
                      className="absolute inset-0 z-20 rounded-lg transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
        {pinnedEntry ? (
          <div className={cn("mt-3 border-t border-border pt-3", tv && "mt-4 pt-4")}>
            <p className={cn("mb-1 text-xs font-medium text-muted-foreground", tv && "text-sm")}>Your entry</p>
            <div
              className={cn(
                "relative flex shrink-0 items-center rounded-lg bg-brand/5 ring-2 ring-brand/70",
                tv ? "h-[64px] gap-4 px-3" : "h-14 gap-2 px-1 sm:gap-3 sm:px-2"
              )}
            >
              <span
                className={cn(
                  "relative z-10 grid shrink-0 place-items-center rounded-full font-mono font-semibold tabular-nums",
                  tv ? "size-9 text-lg" : "size-7 text-xs",
                  pinnedEntry.rank === 1
                    ? "bg-brand text-brand-foreground"
                    : "border border-border bg-background text-muted-foreground"
                )}
              >
                {pinnedEntry.rank}
              </span>
              <Swatch colour={null} className={tv ? "relative z-10 size-6" : "relative z-10 size-4"} />
              <div className="relative z-10 min-w-0 flex-1">
                <p className={cn("truncate font-medium", tv ? "text-2xl" : "text-base")}>{pinnedEntry.title}</p>
                <p className={cn("truncate text-muted-foreground", tv ? "text-base" : "text-xs")}>
                  {pinnedEntry.printCode}
                </p>
              </div>
              <span className={cn("relative z-10 flex shrink-0 items-center gap-1 font-mono tabular-nums", tv ? "text-lg" : "text-xs")}>
                <Heart className={cn("text-brand", tv ? "size-5" : "size-4")} aria-hidden="true" />
                {pinnedEntry.likes}
              </span>
              <span className="relative z-10 flex shrink-0 items-baseline gap-1">
                <span className={cn("font-mono font-bold tabular-nums", tv ? "text-4xl" : "text-xl")}>
                  {pinnedEntry.votes}
                </span>
                <span className={cn("text-muted-foreground", tv ? "text-base" : "hidden text-[0.65rem] sm:inline")}>
                  {pinnedEntry.votes === 1 ? "vote" : "votes"}
                </span>
              </span>
              {onSelect ? (
                <button
                  type="button"
                  aria-label={`View ${pinnedEntry.title} by ${mineDisplayName ?? "you"}`}
                  onClick={() => onSelect(pinnedEntry.printCode)}
                  className="absolute inset-0 z-20 rounded-lg transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
