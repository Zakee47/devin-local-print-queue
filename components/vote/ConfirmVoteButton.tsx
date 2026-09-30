"use client";

import { Check, LogIn, Vote } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import type { GalleryEntry } from "@/convex/votes";
import { VOTES_ARE_FINAL } from "@/lib/event";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VoteButtonState =
  | { kind: "signed_out" }
  | { kind: "unregistered" }
  | { kind: "voted"; canRetract: boolean }
  | { kind: "closed" }
  | { kind: "no_votes_left" }
  | { kind: "available"; votesLeft: number };

export default function ConfirmVoteButton({
  entry,
  state,
  prominent,
  pending,
  onConfirm,
  onRetract,
  className,
}: {
  entry: GalleryEntry;
  state: VoteButtonState;
  prominent: boolean;
  pending: boolean;
  onConfirm: () => void;
  onRetract: () => void;
  className?: string;
}) {
  const base = cn("w-full", className);
  switch (state.kind) {
    case "signed_out":
      return (
        <SignInButton mode="modal">
          <Button variant="outline" className={base}>
            <LogIn data-icon="inline-start" />
            Sign in to like and vote
          </Button>
        </SignInButton>
      );
    case "unregistered":
      return null;
    case "voted":
      return (
        <Button
          variant="brand"
          className={base}
          disabled={pending || !state.canRetract}
          onClick={onRetract}
          aria-pressed
          aria-label={state.canRetract ? `Remove your vote for ${entry.title}` : `You voted for ${entry.title}`}
        >
          <Check data-icon="inline-start" />
          {state.canRetract ? "Voted · tap to remove" : "Voted"}
        </Button>
      );
    case "closed":
      return (
        <Button variant="outline" className={base} disabled>
          Voting is closed
        </Button>
      );
    case "no_votes_left":
      return (
        <Button variant="outline" className={base} disabled>
          No votes left
        </Button>
      );
    case "available":
      return (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant={prominent ? "brand" : "outline"} className={base} disabled={pending} />
            }
          >
            <Vote data-icon="inline-start" />
            Confirm vote
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Vote for {entry.title}?</AlertDialogTitle>
              <AlertDialogDescription>
                {VOTES_ARE_FINAL
                  ? "Votes are final. You can't change this once confirmed."
                  : "You can remove it again until voting closes."}{" "}
                You have {state.votesLeft} vote{state.votesLeft === 1 ? "" : "s"} left.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm}>Confirm vote</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
  }
}
