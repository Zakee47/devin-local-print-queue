"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Heart, Info, LayoutGrid, Layers, Lock, LogIn, RotateCcw, ShieldAlert, Trophy, Undo2, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DroppedVote, GalleryEntry, MyStanding } from "@/convex/votes";
import { useViewerAuth } from "@/lib/use-viewer-auth";
import EventSignInButton from "@/components/EventSignInButton";
import { EVENT_HOME, MAX_VOTES_PER_PARTICIPANT, votingNotOpenYet, type Reaction } from "@/lib/event";
import { DECK_FILTERS, filterCounts, matchesFilter, type DeckFilter } from "@/lib/deck";
import VoteButton, { type VoteButtonState } from "@/components/vote/VoteButton";
import SwipeCard, { type SwipeCardHandle } from "@/components/vote/SwipeCard";
import VoteCard from "@/components/vote/VoteCard";
import { voteAnnouncement, type VoteEvent } from "@/components/vote/announce";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/errors";

type SubmissionId = Id<"submissions">;
type StandingEntry = NonNullable<MyStanding>["entries"][number];
type OwnEntry = { entry: GalleryEntry; standing: StandingEntry };
// `previous` is the reaction before the swipe; `saved` is false for read-only
// (signed-out) swipes that only moved through the deck.
type HistoryItem = { id: SubmissionId; previous: Reaction | undefined; saved: boolean };
type View = "swipe" | "list";

const END = "end" as const;
const CHANGE_COPY = "You can change your votes until voting closes.";
const LOCKED_COPY = "Voting has closed — your votes are locked in";

export default function VoteGallery() {
  const { authReady, signedIn, canQuery } = useViewerAuth();
  const entries = useQuery(api.votes.gallery);
  const settings = useQuery(api.settings.get);
  const ballot = useQuery(api.votes.mine, canQuery ? {} : "skip");
  const myStanding = useQuery(api.votes.myStanding, canQuery ? {} : "skip");
  const myReactions = useQuery(api.likes.mine, canQuery ? {} : "skip");
  const cast = useMutation(api.votes.cast);
  const retract = useMutation(api.votes.retract);
  const swap = useMutation(api.votes.swap);
  const dismissDropped = useMutation(api.votes.dismissDropped);
  const react = useMutation(api.likes.react);
  const clearReaction = useMutation(api.likes.clearReaction);

  const [view, setView] = useState<View>("swipe");
  const [filter, setFilter] = useState<DeckFilter>("unseen");
  const [cursor, setCursor] = useState<SubmissionId | typeof END | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pending, setPending] = useState<SubmissionId | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [ownEntryDetail, setOwnEntryDetail] = useState<OwnEntry | null>(null);
  const cardRef = useRef<SwipeCardHandle>(null);

  const loading =
    entries === undefined ||
    settings === undefined ||
    !authReady ||
    (signedIn && (ballot === undefined || myStanding === undefined || myReactions === undefined));
  const votingOpen = settings?.votingOpen ?? false;
  const notOpenYet = settings ? votingNotOpenYet(settings) : false;
  const closedCopy = notOpenYet ? "Voting hasn't opened yet." : "Voting has closed.";
  const interactive = !!ballot;
  const canReact = interactive && votingOpen;
  // Read-only visitors see every entry; filters only mean something once you react.
  const activeFilter: DeckFilter = interactive ? filter : "all";

  const reactions = useMemo(
    () => new Map((myReactions ?? []).map((r) => [r.submissionId, r.reaction] as const)),
    [myReactions]
  );
  const deck = useMemo(
    () => (entries ?? []).filter((e) => !ballot?.ownSubmissionIds.includes(e._id)),
    [entries, ballot]
  );
  const ownEntries = useMemo<OwnEntry[]>(() => {
    if (!signedIn || !entries || !myStanding) return [];
    return myStanding.entries.flatMap((standing) => {
      const entry = entries.find((candidate) => candidate._id === standing.submissionId);
      return entry ? [{ entry, standing }] : [];
    });
  }, [entries, myStanding, signedIn]);
  const counts = useMemo(() => filterCounts(deck.map((e) => reactions.get(e._id))), [deck, reactions]);
  const list = useMemo(
    () => deck.filter((e) => matchesFilter(reactions.get(e._id), activeFilter)),
    [deck, reactions, activeFilter]
  );
  const current: GalleryEntry | undefined =
    cursor === END ? undefined : (list.find((e) => e._id === cursor) ?? list[0]);
  const votedIds = useMemo(() => ballot?.votedSubmissionIds ?? [], [ballot]);
  const votedEntries = useMemo(
    () => votedIds.map((id) => entries?.find((e) => e._id === id)).filter((e): e is GalleryEntry => !!e),
    [votedIds, entries]
  );

  const changeFilter = (next: DeckFilter) => {
    setFilter(next);
    setCursor(null);
  };

  const open = (id: SubmissionId) => {
    if (!list.some((e) => e._id === id)) setFilter("all");
    setCursor(id);
    setView("swipe");
  };

  const nextAfter = useCallback(
    (id: SubmissionId) => {
      const i = list.findIndex((e) => e._id === id);
      return list[i + 1]?._id ?? END;
    },
    [list]
  );

  const commitSwipe = useCallback(
    (entry: GalleryEntry, direction: Reaction) => {
      const previous = reactions.get(entry._id);
      setHistory((h) => [...h, { id: entry._id, previous, saved: canReact }]);
      setCursor(nextAfter(entry._id));
      if (!canReact || previous === direction) return;
      react({ submissionId: entry._id, reaction: direction }).catch((e: unknown) =>
        toast.error(errorMessage(e, "Couldn't save that"))
      );
    },
    [reactions, canReact, nextAfter, react]
  );

  const undo = useCallback(async () => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    if (!matchesFilter(last.previous, activeFilter)) setFilter("all");
    setCursor(last.id);
    if (!last.saved) return;
    try {
      if (last.previous) await react({ submissionId: last.id, reaction: last.previous });
      else await clearReaction({ submissionId: last.id });
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't undo"));
    }
  }, [history, activeFilter, react, clearReaction]);

  useEffect(() => {
    if (view !== "swipe") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable],[role=dialog],[role=alertdialog]")) return;
      if (e.key === "ArrowRight") cardRef.current?.fling("like");
      else if (e.key === "ArrowLeft") cardRef.current?.fling("skip");
      else if (e.key === "Backspace" || e.key === "ArrowDown" || e.key.toLowerCase() === "u") void undo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, undo]);

  const vote = async (id: SubmissionId, action: () => Promise<unknown>, event: VoteEvent) => {
    setPending(id);
    setAnnouncement("");
    try {
      await action();
      setAnnouncement(voteAnnouncement(event));
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't update your vote"));
    } finally {
      setPending(null);
    }
  };

  const voteState = (id: SubmissionId): VoteButtonState => {
    if (!signedIn) return { kind: "signed_out" };
    if (!ballot) return { kind: "unregistered" };
    if (ballot.votedSubmissionIds.includes(id)) {
      return { kind: "voted", canRetract: votingOpen };
    }
    if (!votingOpen) return notOpenYet ? { kind: "not_open" } : { kind: "closed" };
    if (ballot.votesLeft === 0) return { kind: "no_votes_left", swapFrom: votedEntries };
    return { kind: "available", votesLeft: ballot.votesLeft, maxVotes: ballot.maxVotes };
  };

  const voteControl = (entry: GalleryEntry) => (
    <VoteButton
      entry={entry}
      state={voteState(entry._id)}
      pending={pending === entry._id}
      onVote={() =>
        vote(entry._id, () => cast({ submissionId: entry._id }), {
          kind: "cast",
          title: entry.title,
          votesLeft: (ballot?.votesLeft ?? 0) - 1,
        })
      }
      onRetract={() =>
        vote(entry._id, () => retract({ submissionId: entry._id }), {
          kind: "retract",
          title: entry.title,
          votesLeft: (ballot?.votesLeft ?? 0) + 1,
        })
      }
      onSwap={(from) => {
        const source = votedEntries.find((e) => e._id === from);
        if (!source) return;
        void vote(entry._id, () => swap({ from, to: entry._id }), {
          kind: "swap",
          from: source.title,
          to: entry.title,
        });
      }}
    />
  );

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <Dialog open={ownEntryDetail !== null} onOpenChange={(open) => !open && setOwnEntryDetail(null)}>
        {ownEntryDetail ? (
          <DialogContent className="p-2 sm:max-w-md">
            <DialogHeader className="px-2 pt-2">
              <DialogTitle>{ownEntryDetail.entry.title}</DialogTitle>
              <DialogDescription>
                {ownEntryDetail.entry.printCode} · your competition entry
              </DialogDescription>
            </DialogHeader>
            <ul className="list-none p-0">
              <VoteCard
                entry={ownEntryDetail.entry}
                voted={false}
                canReact={false}
                onToggleLike={() => {}}
                voteControl={null}
                ownStanding={{
                  rank: ownEntryDetail.standing.rank,
                  totalEntries: myStanding?.totalEntries ?? 0,
                  votes: ownEntryDetail.standing.votes,
                }}
              />
            </ul>
          </DialogContent>
        ) : null}
      </Dialog>
      <p className="eyebrow text-muted-foreground">People&apos;s choice</p>
      <h1 className="mt-2 font-heading text-2xl font-semibold sm:mt-3 tracking-[-0.03em] sm:text-5xl">
        Swipe the designs
      </h1>
      <p className="mt-1 text-sm text-muted-foreground sm:hidden">
        You have {MAX_VOTES_PER_PARTICIPANT} votes — they pick the 3D printer winner. Likes are just a shortlist and
        only break ties. {votingOpen ? CHANGE_COPY : closedCopy}
      </p>
      <p className="mt-3 hidden max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:block">
        Every competition entry is in the running for a 3D printer, printed or not. You have{" "}
        {MAX_VOTES_PER_PARTICIPANT} votes: tap Cast vote on your favourites. Swipe right to like or left to skip —
        likes are only a shortlist and break ties, they are not votes.{" "}
        {votingOpen ? CHANGE_COPY : closedCopy}
      </p>
      {notOpenYet ? (
        <Alert className="mt-4 max-w-xl sm:mt-6">
          <Lock />
          <AlertTitle>Voting hasn&apos;t opened yet</AlertTitle>
          <AlertDescription>
            Browse the designs now — the organizers will open voting soon.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 sm:mt-6">
        {loading ? (
          <Skeleton className="h-16 max-w-xl rounded-xl" />
        ) : !signedIn ? (
          <div className="flex flex-wrap items-center gap-3">
            <EventSignInButton>
              <Button variant="brand">
                <LogIn data-icon="inline-start" />
                Sign in to vote
              </Button>
            </EventSignInButton>
            <span className="text-sm text-muted-dim">Anyone can browse. Every registered guest can vote.</span>
          </div>
        ) : !ballot ? (
          <Alert variant="destructive" className="max-w-xl">
            <ShieldAlert />
            <AlertTitle>Only registered guests can vote</AlertTitle>
            <AlertDescription>
              Pick your username on the{" "}
              <Link href={EVENT_HOME} className="underline">
                home page
              </Link>{" "}
              first. You don&apos;t need a submission to vote. You can still browse.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex max-w-xl flex-col gap-3">
            {ballot.droppedVotes.length > 0 ? (
              <DroppedNotice
                dropped={ballot.droppedVotes}
                votingOpen={votingOpen}
                onDismiss={() =>
                  dismissDropped({}).catch((e: unknown) =>
                    toast.error(errorMessage(e, "Couldn't dismiss that"))
                  )
                }
              />
            ) : null}
            <BallotTray
              votesLeft={ballot.votesLeft}
              max={ballot.maxVotes}
              voted={votedEntries}
              votingOpen={votingOpen}
              notOpenYet={notOpenYet}
              pending={pending}
              onOpen={open}
              onRetract={(id) => {
                const entry = votedEntries.find((e) => e._id === id);
                if (!entry) return;
                void vote(id, () => retract({ submissionId: id }), {
                  kind: "retract",
                  title: entry.title,
                  votesLeft: ballot.votesLeft + 1,
                });
              }}
            />
          </div>
        )}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)} className="mt-4 sm:mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="swipe" className="px-3">
              <Layers />
              Swipe
            </TabsTrigger>
            <TabsTrigger value="list" className="px-3">
              <LayoutGrid />
              List
            </TabsTrigger>
          </TabsList>
          {interactive ? (
            <ToggleGroup
              value={[filter]}
              onValueChange={(v) => v[0] && changeFilter(v[0] as DeckFilter)}
              className="flex-wrap gap-1"
              aria-label="Filter competition entries"
            >
              {DECK_FILTERS.map((f) => (
                <ToggleGroupItem key={f.value} value={f.value} variant="outline" size="sm">
                  {f.label}
                  <span className="font-mono text-muted-dim tabular-nums">{counts[f.value]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </div>

        {entries === undefined ? (
          <Skeleton className="mx-auto mt-4 aspect-[4/5] w-full max-w-sm rounded-2xl" />
        ) : entries.length === 0 ? (
          <NoEntries />
        ) : (
          <>
            <TabsContent value="swipe" className="mt-4">
              <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
                {ownEntries.map(({ entry, standing }) => (
                  <section
                    key={entry._id}
                    aria-label="Your entry is live"
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-3 ring-1 ring-brand/20"
                  >
                    {standing.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={standing.previewUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-12 shrink-0 rounded-lg bg-surface object-contain"
                      />
                    ) : (
                      <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-surface text-brand">
                        <Trophy className="size-5" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {votingOpen
                          ? "Your entry is live"
                          : notOpenYet
                            ? "Your entry · voting opens soon"
                            : "Your entry · voting closed"}
                      </p>
                      <p className="truncate text-sm font-medium">
                        {entry.printCode} · {entry.title}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        #{standing.rank} of {myStanding?.totalEntries ?? 0} · {standing.votes}{" "}
                        {standing.votes === 1 ? "vote" : "votes"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setOwnEntryDetail({ entry, standing })}
                    >
                      View
                    </Button>
                  </section>
                ))}
                {current ? (
                  <div className="relative">
                    <div aria-hidden className="absolute inset-x-3 -bottom-2 top-2 rounded-2xl bg-card/60 ring-1 ring-foreground/5" />
                    <SwipeCard
                      key={current._id}
                      ref={cardRef}
                      entry={current}
                      reaction={reactions.get(current._id)}
                      voted={votedIds.includes(current._id)}
                      voteNumber={votedIds.indexOf(current._id) + 1 || undefined}
                      onSwipe={(direction) => commitSwipe(current, direction)}
                      footer={voteControl(current)}
                    />
                  </div>
                ) : (
                  <DeckEnd
                    filter={activeFilter}
                    empty={list.length === 0}
                    onRestart={() => setCursor(null)}
                    onShowAll={() => changeFilter("all")}
                  />
                )}
                <div className="flex items-start justify-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-lg"
                      className="size-14 rounded-full"
                      disabled={!current}
                      onClick={() => cardRef.current?.fling("skip")}
                      aria-label={canReact ? "Skip" : "Next"}
                    >
                      <X className="size-6" />
                    </Button>
                    <span className="text-xs text-muted-foreground">Skip</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="size-11 rounded-full"
                    disabled={history.length === 0}
                    onClick={() => void undo()}
                    aria-label="Undo last swipe"
                  >
                    <Undo2 className="size-5" />
                  </Button>
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-lg"
                      className="size-14 rounded-full"
                      disabled={!current}
                      onClick={() => cardRef.current?.fling("like")}
                      aria-label={canReact ? "Like (tie-breaker only, not a vote)" : "Next"}
                    >
                      <Heart className="size-6" />
                    </Button>
                    <span className="text-xs text-muted-foreground">Like · tie-breaker</span>
                  </div>
                </div>
                <p className="hidden text-center text-xs text-muted-dim sm:block">
                  Keyboard: ← skip · → like · Backspace undo · Likes aren&apos;t votes
                </p>
                {!canReact && current ? (
                  <p className="text-center text-xs text-muted-dim">
                    {interactive ? `${LOCKED_COPY}. Browsing only.` : votingOpen ? "Browsing only. Sign in to save likes." : `${closedCopy} Browsing only.`}
                  </p>
                ) : null}
              </div>
            </TabsContent>
            <TabsContent value="list" className="mt-4">
              {ownEntries.length ? (
                <section aria-labelledby="your-entry-heading" className="mb-6">
                  <h2 id="your-entry-heading" className="mb-3 font-heading text-lg font-semibold">
                    Your entry
                  </h2>
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {ownEntries.map(({ entry, standing }) => (
                      <VoteCard
                        key={entry._id}
                        entry={entry}
                        voted={false}
                        canReact={false}
                        onToggleLike={() => {}}
                        voteControl={null}
                        ownStanding={{
                          rank: standing.rank,
                          totalEntries: myStanding?.totalEntries ?? 0,
                          votes: standing.votes,
                        }}
                        onOpen={() => setOwnEntryDetail({ entry, standing })}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
              {list.length === 0 ? (
                <Empty className="border border-dashed border-border-strong py-16">
                  <EmptyHeader>
                    <EmptyTitle>Nothing here</EmptyTitle>
                    <EmptyDescription>No entries match this filter.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((entry) => (
                    <VoteCard
                      key={entry._id}
                      entry={entry}
                      reaction={reactions.get(entry._id)}
                      voted={votedIds.includes(entry._id)}
                      voteNumber={votedIds.indexOf(entry._id) + 1 || undefined}
                      canReact={canReact}
                      onToggleLike={() => {
                        const update =
                          reactions.get(entry._id) === "like"
                            ? clearReaction({ submissionId: entry._id })
                            : react({ submissionId: entry._id, reaction: "like" });
                        update.catch((e: unknown) =>
                          toast.error(errorMessage(e, "Couldn't save that"))
                        );
                      }}
                      voteControl={voteControl(entry)}
                      onOpen={() => open(entry._id)}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  );
}

function BallotTray({
  votesLeft,
  max,
  voted,
  votingOpen,
  notOpenYet,
  pending,
  onOpen,
  onRetract,
}: {
  votesLeft: number;
  max: number;
  voted: GalleryEntry[];
  votingOpen: boolean;
  notOpenYet?: boolean;
  pending: SubmissionId | null;
  onOpen: (id: SubmissionId) => void;
  onRetract: (id: SubmissionId) => void;
}) {
  return (
    <section
      aria-label="Your ballot"
      className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-lg font-medium tracking-tight">Your ballot</p>
        {votingOpen ? (
          <span className="shrink-0 font-mono text-sm tabular-nums">
            {votesLeft} of {max} votes left
          </span>
        ) : !notOpenYet ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Locked
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: max }, (_, index) => {
          const entry = voted[index];
          if (!entry) {
            return (
              <div
                key={`empty-${index}`}
                className="min-w-0 rounded-lg border border-dashed border-border-strong px-3 py-2"
              >
                <span className="block text-[10px] font-mono text-muted-foreground">Vote {index + 1}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {votingOpen ? "Empty" : "Not used"}
                </span>
              </div>
            );
          }
          return (
            <div key={entry._id} className="relative min-w-0">
              <button
                type="button"
                onClick={() => onOpen(entry._id)}
                className="w-full min-w-0 rounded-lg bg-brand/15 px-3 py-2 pr-9 text-left ring-1 ring-brand/40 hover:bg-brand/25"
              >
                <span className="block text-[10px] font-mono text-muted-foreground">Vote {index + 1}</span>
                <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{entry.printCode}</span>
                <span className="block truncate text-sm font-medium">{entry.title}</span>
              </button>
              {votingOpen ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1 right-1 text-muted-foreground"
                  aria-label={`Remove your vote for ${entry.title}`}
                  disabled={pending !== null}
                  onClick={() => onRetract(entry._id)}
                >
                  <X />
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {votingOpen ? CHANGE_COPY : notOpenYet ? "Voting hasn't opened yet." : LOCKED_COPY}
      </p>
    </section>
  );
}

function DroppedNotice({
  dropped,
  votingOpen,
  onDismiss,
}: {
  dropped: DroppedVote[];
  votingOpen: boolean;
  onDismiss: () => void;
}) {
  const label = (d: DroppedVote) => (d.printCode ? `${d.printCode} ${d.title}` : "a removed design");
  const gone = dropped.filter((d) => !d.replaced);
  const replaced = dropped.filter((d) => d.replaced);
  const parts = [
    gone.length ? `${gone.map(label).join(", ")} ${gone.length === 1 ? "is" : "are"} no longer in the running` : null,
    replaced.length ? `${replaced.map(label).join(", ")} ${replaced.length === 1 ? "has" : "have"} a new file` : null,
  ].filter(Boolean);
  return (
    <Alert>
      <Info />
      <AlertTitle>
        {dropped.length === 1 ? "A vote came back to you" : `${dropped.length} votes came back to you`}
      </AlertTitle>
      <AlertDescription>
        <p>
          {parts.join(" and ")}, so {dropped.length === 1 ? "that vote doesn't" : "those votes don't"} count.
          {votingOpen ? ` Spend ${dropped.length === 1 ? "it" : "them"} on another design.` : null}
        </p>
        <Button variant="outline" size="sm" className="mt-2" onClick={onDismiss}>
          Got it
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function DeckEnd({
  filter,
  empty,
  onRestart,
  onShowAll,
}: {
  filter: DeckFilter;
  empty: boolean;
  onRestart: () => void;
  onShowAll: () => void;
}) {
  const label = DECK_FILTERS.find((f) => f.value === filter)?.label ?? "";
  return (
    <Empty className="aspect-[4/5] border border-dashed border-border-strong">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Layers />
        </EmptyMedia>
        <EmptyTitle>{empty ? `No cards in “${label}”` : "You've reached the end"}</EmptyTitle>
        <EmptyDescription>
          {filter === "unseen" ? "You've seen every entry. Check your likes, then cast your votes." : "Go round again or pick another filter."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        {!empty ? (
          <Button variant="outline" size="sm" onClick={onRestart}>
            <RotateCcw data-icon="inline-start" />
            Start over
          </Button>
        ) : null}
        {filter !== "all" ? (
          <Button variant="outline" size="sm" onClick={onShowAll}>
            Show all
          </Button>
        ) : null}
      </EmptyContent>
    </Empty>
  );
}

function NoEntries() {
  return (
    <Empty className="mt-4 border border-dashed border-border-strong py-20">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Trophy />
        </EmptyMedia>
        <EmptyTitle>No competition entries yet</EmptyTitle>
        <EmptyDescription>
          Designs show up here as soon as they&apos;re entered in the competition.{" "}
          <Link href="/submit" className={buttonVariants({ variant: "link" })}>
            Submit yours
          </Link>
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
