"use client";

import { ArrowLeftRight, Check, Clock, Lock, LogIn, Vote } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { GalleryEntry } from "@/convex/votes";
import EventSignInButton from "@/components/EventSignInButton";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type VoteButtonState =
  | { kind: "signed_out" }
  | { kind: "unregistered" }
  | { kind: "voted"; canRetract: boolean }
  | { kind: "closed" }
  | { kind: "not_open" }
  | { kind: "no_votes_left"; swapFrom: GalleryEntry[] }
  | { kind: "available"; votesLeft: number; maxVotes: number };

export default function VoteButton({
  entry,
  state,
  pending,
  onVote,
  onRetract,
  onSwap,
  className,
}: {
  entry: GalleryEntry;
  state: VoteButtonState;
  pending: boolean;
  onVote: () => void;
  onRetract: () => void;
  onSwap: (from: Id<"submissions">) => void;
  className?: string;
}) {
  const base = cn("w-full", className);
  switch (state.kind) {
    case "signed_out":
      return (
        <EventSignInButton>
          <Button variant="outline" size="lg" className={base}>
            <LogIn data-icon="inline-start" />
            Sign in to vote
          </Button>
        </EventSignInButton>
      );
    case "unregistered":
      return null;
    case "voted":
      return (
        <Button
          variant="brand"
          size="lg"
          className={base}
          disabled={pending || !state.canRetract}
          onClick={onRetract}
          aria-pressed
          aria-label={state.canRetract ? `Remove your vote for ${entry.title}` : `You voted for ${entry.title}`}
        >
          {state.canRetract ? <Check data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
          {state.canRetract ? "Voted · tap to remove" : "Your vote · locked in"}
        </Button>
      );
    case "closed":
      return (
        <Button variant="outline" size="lg" className={base} disabled>
          <Lock data-icon="inline-start" />
          Voting has closed
        </Button>
      );
    case "not_open":
      return (
        <Button variant="outline" size="lg" className={base} disabled>
          <Clock data-icon="inline-start" />
          Voting hasn&apos;t opened yet
        </Button>
      );
    case "no_votes_left":
      return (
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="lg" className={base} disabled={pending} />}>
            <ArrowLeftRight data-icon="inline-start" />
            Swap a vote to this
          </PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Move a vote to {entry.title}</PopoverTitle>
              <PopoverDescription>Pick the vote to give up.</PopoverDescription>
            </PopoverHeader>
            <div className="flex flex-col gap-1.5">
              {state.swapFrom.map((from) => (
                <Button
                  key={from._id}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => onSwap(from._id)}
                >
                  <span className="font-mono text-muted-foreground">{from.printCode}</span>
                  <span className="truncate">{from.title}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      );
    case "available":
      return (
        <Button
          variant="brand"
          size="lg"
          className={base}
          disabled={pending}
          onClick={onVote}
          aria-label={`Cast a vote for ${entry.title}. ${state.votesLeft} of ${state.maxVotes} votes left.`}
        >
          <Vote data-icon="inline-start" />
          Cast vote · {state.votesLeft} of {state.maxVotes} left
        </Button>
      );
  }
}
