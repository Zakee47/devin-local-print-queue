"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, LogIn, ShieldAlert, Trophy } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useViewerAuth } from "@/lib/use-viewer-auth";
import { MAX_VOTES_PER_PARTICIPANT } from "@/lib/event";
import VoteCard, { type VoteState } from "@/components/vote/VoteCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function VoteGallery() {
  const { authReady, signedIn, canQuery } = useViewerAuth();
  const entries = useQuery(api.votes.gallery);
  const settings = useQuery(api.settings.get);
  const ballot = useQuery(api.votes.mine, canQuery ? {} : "skip");
  const cast = useMutation(api.votes.cast);
  const retract = useMutation(api.votes.retract);
  const [pending, setPending] = useState<Id<"submissions"> | null>(null);

  const loading =
    entries === undefined ||
    settings === undefined ||
    !authReady ||
    (signedIn && ballot === undefined);
  const votingOpen = settings?.votingOpen ?? false;

  const run = async (
    id: Id<"submissions">,
    action: (args: { submissionId: Id<"submissions"> }) => Promise<unknown>
  ) => {
    setPending(id);
    try {
      await action({ submissionId: id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update your vote");
    } finally {
      setPending(null);
    }
  };

  const stateFor = (id: Id<"submissions">): VoteState => {
    if (!ballot) return { kind: "browse" };
    if (ballot.ownSubmissionIds.includes(id)) return { kind: "own" };
    if (ballot.votedSubmissionIds.includes(id)) return { kind: "voted", canChange: votingOpen };
    return { kind: "available", canVote: votingOpen && ballot.votesLeft > 0 };
  };

  return (
    <>
      <p className="eyebrow text-muted-foreground">People&apos;s choice</p>
      <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
        Vote for your favourite keychains
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        Every entry here has been printed. Each entrant gets {MAX_VOTES_PER_PARTICIPANT} votes,
        one per design, and can&apos;t vote for their own. You can change your picks until voting
        closes.
      </p>

      <div className="mt-8">
        {loading ? (
          <Skeleton className="h-16 max-w-xl rounded-xl" />
        ) : !votingOpen ? (
          <Alert className="max-w-xl">
            <Lock />
            <AlertTitle>Voting is closed</AlertTitle>
            <AlertDescription>
              {ballot && ballot.votedSubmissionIds.length > 0
                ? `Your ${plural(ballot.votedSubmissionIds.length, "vote")} ${ballot.votedSubmissionIds.length === 1 ? "is" : "are"} locked in. `
                : ""}
              Browse the entries while you wait for the organizers.
            </AlertDescription>
          </Alert>
        ) : !signedIn ? (
          <div className="flex flex-wrap items-center gap-4">
            <SignInButton mode="modal">
              <Button variant="brand" size="lg">
                <LogIn data-icon="inline-start" />
                Sign in to vote
              </Button>
            </SignInButton>
            <span className="text-sm text-muted-dim">
              Anyone can browse. Checked-in entrants can vote.
            </span>
          </div>
        ) : !ballot ? (
          <Alert variant="destructive" className="max-w-xl">
            <ShieldAlert />
            <AlertTitle>Only registered entrants can vote</AlertTitle>
            <AlertDescription>
              Create your entrant account from the{" "}
              <Link href="/" className="underline">
                home page
              </Link>{" "}
              first.
            </AlertDescription>
          </Alert>
        ) : (
          <p className="font-heading text-2xl font-medium tracking-tight" aria-live="polite">
            {ballot.votesLeft > 0
              ? `You have ${plural(ballot.votesLeft, "vote")} left`
              : "All votes used. Tap Voted to change a pick."}
          </p>
        )}
      </div>

      <div className="mt-10">
        {entries === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Empty className="border border-dashed border-border-strong py-20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No printed entries yet</EmptyTitle>
              <EmptyDescription>
                Keychains show up here as soon as they come off the printer.{" "}
                <Link href="/submit" className={buttonVariants({ variant: "link" })}>
                  Submit yours
                </Link>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <VoteCard
                key={entry._id}
                entry={entry}
                state={stateFor(entry._id)}
                pending={pending === entry._id}
                onVote={() => run(entry._id, cast)}
                onRetract={() => run(entry._id, retract)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
