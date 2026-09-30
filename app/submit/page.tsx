"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Lock } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useViewerAuth } from "@/lib/use-viewer-auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SubmissionCard from "@/components/participant/SubmissionCard";
import UploadCard from "@/components/participant/UploadCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_SUBMISSIONS_PER_PARTICIPANT } from "@/lib/event";

function EntriesSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading your entries">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <Skeleton className="aspect-4/3 w-full rounded-lg" />
          <Skeleton className="h-5 w-2/3 rounded-sm" />
          <Skeleton className="h-4 w-1/2 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

export default function SubmitPage() {
  const router = useRouter();
  const { authReady, signedIn, canQuery } = useViewerAuth();
  const status = useQuery(api.participants.viewerStatus, canQuery ? {} : "skip");
  const registered = status?.state === "registered";
  const submissions = useQuery(api.submissions.mine, registered ? {} : "skip");
  const settings = useQuery(api.settings.get);

  useEffect(() => {
    if (status && status.state !== "registered" && status.state !== "signed_out") router.replace("/");
  }, [status, router]);

  const active = submissions?.filter((s) => s.status !== "rejected") ?? [];
  const sorted = submissions
    ? [...submissions].sort(
        (a, b) =>
          Number(a.status === "rejected") - Number(b.status === "rejected") ||
          a._creationTime - b._creationTime
      )
    : [];
  const slotsLeft = MAX_SUBMISSIONS_PER_PARTICIPANT - active.length;
  const choiceLocked = active.some((s) => s.status !== "submitted");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em]">My entries</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload up to {MAX_SUBMISSIONS_PER_PARTICIPANT} designs and choose one to print. Status updates live.
          </p>
        </div>

        {!authReady || (signedIn && (!status || status.state !== "registered")) ? (
          <EntriesSkeleton />
        ) : !signedIn ? (
          <Card className="mx-auto max-w-md">
            <CardHeader>
              <CardTitle>Sign in to submit</CardTitle>
              <CardDescription>Use the email you registered with on Luma.</CardDescription>
            </CardHeader>
            <CardContent>
              <SignInButton mode="modal">
                <Button variant="brand" size="lg" className="w-full">
                  <LogIn data-icon="inline-start" />
                  Sign in
                </Button>
              </SignInButton>
            </CardContent>
          </Card>
        ) : submissions === undefined || settings === undefined ? (
          <EntriesSkeleton />
        ) : submissions === null ? (
          <Alert variant="destructive">
            <AlertTitle>You&apos;re not registered yet</AlertTitle>
            <AlertDescription>
              <Link href="/" className="underline">
                Create your entrant account
              </Link>{" "}
              first.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-5">
            {choiceLocked ? (
              <Alert>
                <Lock />
                <AlertTitle>Your print choice is locked in</AlertTitle>
                <AlertDescription>An organizer has accepted one of your entries into the print queue.</AlertDescription>
              </Alert>
            ) : null}
            {sorted.map((s) => (
              <SubmissionCard
                key={s._id}
                submission={s}
                colours={settings.colours}
                showPrintChoice={active.length > 1}
              />
            ))}
            {slotsLeft > 0 ? (
              settings.submissionsOpen ? (
                <UploadCard colours={settings.colours} maxFileBytes={settings.maxFileBytes} slotsLeft={slotsLeft} />
              ) : (
                <Alert>
                  <AlertTitle>Submissions are closed</AlertTitle>
                  <AlertDescription>The organizers aren&apos;t accepting new designs right now.</AlertDescription>
                </Alert>
              )
            ) : null}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
