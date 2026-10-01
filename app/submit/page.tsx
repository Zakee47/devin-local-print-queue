"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Lock, Star } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useViewerAuth } from "@/lib/use-viewer-auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useNow } from "@/components/NoticeBanner";
import PublicNameCard from "@/components/participant/PublicNameCard";
import SubmissionCard from "@/components/participant/SubmissionCard";
import UploadCard from "@/components/participant/UploadCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_SUBMISSIONS_PER_PARTICIPANT, submissionsAreOpen, submissionsNotOpenYet } from "@/lib/event";

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
  const now = useNow();
  const open = settings ? submissionsAreOpen(settings, now) : false;

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
  const hasEntry = active.some((s) => s.printRequested);
  const needsPick = !hasEntry && active.length > 0 && !choiceLocked;
  const canUploadReplacement = submissions?.some((s) => s.canUploadReplacement) ?? false;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em]">My entries</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload up to {MAX_SUBMISSIONS_PER_PARTICIPANT} files and pick one as your entry — it&apos;s the one we
            print and the one people vote on.
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
            {status?.state === "registered" ? <PublicNameCard username={status.displayName} /> : null}
            {choiceLocked ? (
              <Alert>
                <Lock />
                <AlertTitle>Your entry is locked in</AlertTitle>
                <AlertDescription>An organizer has accepted it into the print queue.</AlertDescription>
              </Alert>
            ) : null}
            {needsPick ? (
              <Alert>
                <Star />
                <AlertTitle>Pick your entry</AlertTitle>
                <AlertDescription>
                  Your entry was sent back, so you don&apos;t have one right now. Make your other upload your entry
                  {open ? ", or upload a new design" : ""}.
                </AlertDescription>
              </Alert>
            ) : null}
            {sorted.map((s) => (
              <SubmissionCard
                key={s._id}
                submission={s}
                colours={settings.colours}
                printers={settings.printers}
                showEntryChoice={needsPick || (open && active.length > 1)}
                submissionsOpen={open}
              />
            ))}
            {slotsLeft > 0 ? (
              open || canUploadReplacement ? (
                <>
                  {!open ? (
                    <Alert>
                      <AlertTitle>Your print failed</AlertTitle>
                      <AlertDescription>
                        Your print failed — you can upload a fixed version even though submissions have closed.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <UploadCard
                    colours={settings.colours}
                    printers={settings.printers}
                    maxFileBytes={settings.maxFileBytes}
                    maxDimensionsMm={settings.maxDimensionsMm}
                    slotsLeft={slotsLeft}
                  />
                </>
              ) : submissionsNotOpenYet(settings, now) ? (
                <Alert>
                  <AlertTitle>Submissions are not open yet</AlertTitle>
                  <AlertDescription>
                    The organizers will open submissions soon — keep this page open and the upload
                    form will appear here.
                  </AlertDescription>
                </Alert>
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
