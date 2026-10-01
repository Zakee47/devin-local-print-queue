"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, LogIn, Printer, ShieldAlert, Tv } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useViewerAuth } from "@/lib/use-viewer-auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LiveLeaderboard from "@/components/leaderboard/LiveLeaderboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CHALLENGE, EVENT_NAME, EVENT_URL, MAX_SUBMISSIONS_PER_PARTICIPANT } from "@/lib/event";
import { validateUsername } from "@/lib/usernames";
import { cn } from "@/lib/utils";

const HERO_BUTTON =
  "h-12 min-w-44 gap-2 px-7 text-base has-data-[icon=inline-start]:pl-6 sm:h-11 sm:min-w-0 sm:px-4.5 sm:text-[15px]";

export default function Home() {
  const [username, setUsername] = useState("");
  const { authReady, signedIn, canQuery } = useViewerAuth();
  const status = useQuery(api.participants.viewerStatus, canQuery ? {} : "skip");
  const liveLeaderboard = useQuery(api.tv.leaderboard);
  const register = useMutation(api.participants.register);
  const usernameError = username ? validateUsername(username) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader width="wide" showSignIn={false} />
      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-col px-4 py-16 sm:px-6 sm:py-20">
        <p className="eyebrow text-muted-foreground">{EVENT_NAME}</p>
        <h1 className="mt-6 font-heading text-5xl leading-[0.98] font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
          {CHALLENGE}. We&apos;ll print it.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Upload up to {MAX_SUBMISSIONS_PER_PARTICIPANT} STL or 3MF files and pick one to print. Follow it
          from queued to printing to done, then vote for your two favourite designs.
        </p>
        <div className="mt-8 flex flex-col gap-4">
          {!authReady || (signedIn && status === undefined) ? (
            <Skeleton className="h-12 w-44 rounded-md" />
          ) : !signedIn ? (
            <div>
              <SignInButton mode="modal">
                <Button variant="brand" size="lg" className={HERO_BUTTON}>
                  <LogIn data-icon="inline-start" />
                  Sign in with your Luma email
                </Button>
              </SignInButton>
              <p className="mt-3 text-xs text-muted-dim">
                Use the email you registered with on{" "}
                <a href={EVENT_URL} className="underline" target="_blank" rel="noreferrer">
                  Luma
                </a>
                . You need to be checked in at the venue.
              </p>
            </div>
          ) : status?.state === "registered" ? (
            <Link href="/submit" className={cn(buttonVariants({ variant: "brand", size: "lg" }), HERO_BUTTON, "w-fit")}>
              <Printer data-icon="inline-start" />
              My entries
              <ArrowRight data-icon="inline-end" />
            </Link>
          ) : status?.state === "eligible" ? (
            <FieldGroup className="max-w-sm gap-3">
              <Field data-invalid={Boolean(usernameError)}>
                <FieldLabel htmlFor="entrant-username">Choose your username</FieldLabel>
                <Input
                  id="entrant-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Ada Lovelace"
                  aria-invalid={Boolean(usernameError)}
                  aria-describedby={usernameError ? "entrant-username-error" : undefined}
                />
                {usernameError ? (
                  <FieldDescription id="entrant-username-error">{usernameError}</FieldDescription>
                ) : null}
              </Field>
              <Button
                variant="brand"
                size="lg"
                className={cn(HERO_BUTTON, "w-fit")}
                disabled={!username.trim() || Boolean(usernameError)}
                onClick={async () => {
                  try {
                    await register({ username });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Couldn't create your account");
                  }
                }}
              >
                Create my entrant account
              </Button>
            </FieldGroup>
          ) : status?.state === "blocked" ? (
            <Alert variant="destructive" className="max-w-xl">
              <ShieldAlert />
              <AlertTitle>This account has been removed</AlertTitle>
              <AlertDescription>
                The organisers have removed {status.email} from the entrant list.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive" className="max-w-xl">
              <ShieldAlert />
              <AlertTitle>
                {status?.state === "unverified" ? "Verify your email first" : "You're not on the checked-in list"}
              </AlertTitle>
              <AlertDescription>
                {status?.state === "not_on_guest_list"
                  ? `${status.email} isn't a checked-in guest yet. Check in at the desk, or sign in with the email you used on Luma.`
                  : "Your sign-in email needs to be verified."}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <Link
          href="/tv"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-4 w-fit")}
        >
          <Tv data-icon="inline-start" />
          TV mode
        </Link>
      </main>
      <div className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
          {liveLeaderboard === undefined ? (
            <Skeleton className="h-80 rounded-xl" />
          ) : (
            <LiveLeaderboard
              variant="page"
              rows={liveLeaderboard.leaderboard}
              totalVotes={liveLeaderboard.totalVotes}
              totalLikes={liveLeaderboard.totalLikes}
              votingOpen={liveLeaderboard.votingOpen}
              votingNotOpenYet={liveLeaderboard.votingNotOpenYet}
            />
          )}
        </div>
      </div>
      <SiteFooter width="wide" />
    </div>
  );
}
