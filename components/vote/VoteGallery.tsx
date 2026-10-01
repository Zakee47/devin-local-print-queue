"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Heart, Info, LayoutGrid, Layers, Lock, LogIn, RotateCcw, ShieldAlert, Trophy, Undo2, X } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DroppedVote, GalleryEntry } from "@/convex/votes";
import { useViewerAuth } from "@/lib/use-viewer-auth";
import { MAX_VOTES_PER_PARTICIPANT, votingNotOpenYet, type Reaction } from "@/lib/event";
import { DECK_FILTERS, filterCounts, matchesFilter, type DeckFilter } from "@/lib/deck";
import VoteButton, { type VoteButtonState } from "@/components/vote/VoteButton";
import SwipeCard, { type SwipeCardHandle } from "@/components/vote/SwipeCard";
import VoteCard from "@/components/vote/VoteCard";
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

type SubmissionId = Id<"submissions">;
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
  const cardRef = useRef<SwipeCardHandle>(null);

  const loading =
    entries === undefined ||
    settings === undefined ||
    !authReady ||
    (signedIn && (ballot === undefined || myReactions === undefined));
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
        toast.error(e instanceof Error ? e.message : "Couldn't save that")
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
      toast.error(e instanceof Error ? e.message : "Couldn't undo");
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

  const vote = async (id: SubmissionId, action: () => Promise<unknown>) => {
    setPending(id);
    try {
      await action();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update your vote");
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
    return { kind: "available", votesLeft: ballot.votesLeft };
  };

  const voteControl = (entry: GalleryEntry) => (
    <VoteButton
      entry={entry}
      state={voteState(entry._id)}
      prominent={reactions.get(entry._id) === "like"}
      pending={pending === entry._id}
      onVote={() => vote(entry._id, () => cast({ submissionId: entry._id }))}
      onRetract={() => vote(entry._id, () => retract({ submissionId: entry._id }))}
      onSwap={(from) => vote(entry._id, () => swap({ from, to: entry._id }))}
    />
  );

  return (
    <>
      <p className="eyebrow text-muted-foreground">People&apos;s choice</p>
      <h1 className="mt-2 font-heading text-2xl font-semibold sm:mt-3 tracking-[-0.03em] sm:text-5xl">
        Swipe the designs
      </h1>
      <p className="mt-1 text-sm text-muted-foreground sm:hidden">
        Swipe right to like, left to skip. {votingOpen ? CHANGE_COPY : closedCopy}
      </p>
      <p className="mt-3 hidden max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:block">
        Every competition entry is in the running for a 3D printer, printed or not. Swipe right to like, left to
        skip. Likes break
        ties. When you find a favourite, give it one of your {MAX_VOTES_PER_PARTICIPANT} votes.{" "}
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
            <SignInButton mode="modal">
              <Button variant="brand">
                <LogIn data-icon="inline-start" />
                Sign in to like and vote
              </Button>
            </SignInButton>
            <span className="text-sm text-muted-dim">Anyone can browse. Every registered guest can vote.</span>
          </div>
        ) : !ballot ? (
          <Alert variant="destructive" className="max-w-xl">
            <ShieldAlert />
            <AlertTitle>Only registered guests can like and vote</AlertTitle>
            <AlertDescription>
              Pick your username on the{" "}
              <Link href="/" className="underline">
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
                    toast.error(e instanceof Error ? e.message : "Couldn't dismiss that")
                  )
                }
              />
            ) : null}
            <BallotSummary
              used={ballot.votedSubmissionIds.length}
              max={ballot.maxVotes}
              voted={votedEntries}
              votingOpen={votingOpen}
              notOpenYet={notOpenYet}
              onOpen={open}
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
                {current ? (
                  <div className="relative">
                    <div aria-hidden className="absolute inset-x-3 -bottom-2 top-2 rounded-2xl bg-card/60 ring-1 ring-foreground/5" />
                    <SwipeCard
                      key={current._id}
                      ref={cardRef}
                      entry={current}
                      reaction={reactions.get(current._id)}
                      voted={votedIds.includes(current._id)}
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
                <div className="flex items-center justify-center gap-4">
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
                  <Button
                    variant="brand"
                    size="icon-lg"
                    className="size-14 rounded-full"
                    disabled={!current}
                    onClick={() => cardRef.current?.fling("like")}
                    aria-label={canReact ? "Like" : "Next"}
                  >
                    <Heart className="size-6" />
                  </Button>
                </div>
                <p className="hidden text-center text-xs text-muted-dim sm:block">
                  Keyboard: ← skip · → like · Backspace undo
                </p>
                {!canReact && current ? (
                  <p className="text-center text-xs text-muted-dim">
                    {interactive ? `${LOCKED_COPY}. Browsing only.` : votingOpen ? "Browsing only. Sign in to save likes." : `${closedCopy} Browsing only.`}
                  </p>
                ) : null}
              </div>
            </TabsContent>
            <TabsContent value="list" className="mt-4">
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

function BallotSummary({
  used,
  max,
  voted,
  votingOpen,
  notOpenYet,
  onOpen,
}: {
  used: number;
  max: number;
  voted: GalleryEntry[];
  votingOpen: boolean;
  notOpenYet?: boolean;
  onOpen: (id: SubmissionId) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 sm:p-4 ring-foreground/10" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-lg font-medium tracking-tight">
          {used} of {max} votes used
        </p>
        {!votingOpen && !notOpenYet ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Locked
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {votingOpen ? CHANGE_COPY : notOpenYet ? "Voting hasn't opened yet." : LOCKED_COPY}
      </p>
      {voted.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {voted.map((e) => (
            <li key={e._id}>
              <button
                type="button"
                onClick={() => onOpen(e._id)}
                className="flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-brand/40 hover:bg-brand/25"
              >
                <span className="font-mono text-muted-foreground">{e.printCode}</span>
                {e.title}
              </button>
            </li>
          ))}
        </ul>
      ) : votingOpen ? (
        <p className="text-sm text-muted-dim">Like the ones you love, then vote for your favourites.</p>
      ) : null}
    </div>
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
  const names = dropped.map((d) => (d.printCode ? `${d.printCode} ${d.title}` : "a removed design"));
  return (
    <Alert>
      <Info />
      <AlertTitle>
        {dropped.length === 1 ? "A vote came back to you" : `${dropped.length} votes came back to you`}
      </AlertTitle>
      <AlertDescription>
        <p>
          {names.join(", ")} {dropped.length === 1 ? "is" : "are"} no longer in the running (withdrawn, swapped
          or removed from the competition), so {dropped.length === 1 ? "that vote doesn't" : "those votes don't"} count.
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
          {filter === "unseen" ? "You've seen every entry. Revisit your likes to pick your votes." : "Go round again or pick another filter."}
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
