"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogIn, Lock, Printer, Trophy } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useViewerAuth } from "@/lib/use-viewer-auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import DevinPlaybookCard from "@/components/participant/DevinPlaybookCard";
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
  const completePlaybookStep = useMutation(api.participants.completePlaybookStep);
  const [completingPlaybookStep, setCompletingPlaybookStep] = useState(false);
  const [showPlaybook, setShowPlaybook] = useState(false);
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
  const hasPrintRequest = active.some((s) => s.printRequested);
  const needsPrintPick = !hasPrintRequest && active.length > 0 && !choiceLocked;
  const hasDesignEntry = submissions?.some((s) => s.designEntry && !s.designRemoved) ?? false;
  const needsDesignPick = !hasDesignEntry && open && active.some((s) => !s.designRemoved);
  const canUploadReplacement = submissions?.some((s) => s.canUploadReplacement) ?? false;
  const showPlaybookStep = status?.state === "registered" && !status.playbookStepDone;

  async function finishPlaybookStep() {
    setCompletingPlaybookStep(true);
    try {
      await completePlaybookStep({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update your playbook step");
    } finally {
      setCompletingPlaybookStep(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {showPlaybookStep ? (
          <section aria-labelledby="playbook-step-heading" className="mx-auto max-w-2xl">
            <h2
              id="playbook-step-heading"
              className="mb-5 font-heading text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
            >
              Step 1: Design with Devin
            </h2>
            <DevinPlaybookCard variant="full">
              <Button
                type="button"
                variant="brand"
                onClick={finishPlaybookStep}
                disabled={completingPlaybookStep}
              >
                {completingPlaybookStep ? "Saving..." : "I've started — continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={finishPlaybookStep}
                disabled={completingPlaybookStep}
              >
                Skip for now
              </Button>
            </DevinPlaybookCard>
          </section>
        ) : (
          <>
            <div className="mb-6 sm:mb-8">
              <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em]">My entries</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload up to {MAX_SUBMISSIONS_PER_PARTICIPANT} files, then make two separate picks. They can be the
                same file or different ones.
              </p>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                <li className="flex items-start gap-2">
                  <Trophy className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                  <span>
                    <span className="font-medium">Competition entry</span>
                    <span className="text-muted-foreground"> — voted on to win a 3D printer. Goes live straight away.</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Printer className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    <span className="font-medium">Print request</span>
                    <span className="text-muted-foreground"> — printed for you, needs staff approval.</span>
                  </span>
                </li>
              </ul>
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
                {status?.state === "registered" ? (
                  <>
                    <PublicNameCard username={status.displayName} />
                    <div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                        <p className="min-w-0 truncate text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Design playbook</span>
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-expanded={showPlaybook}
                          aria-controls="design-playbook-details"
                          onClick={() => setShowPlaybook((open) => !open)}
                        >
                          {showPlaybook ? "Hide" : "Show"}
                          <ChevronDown
                            data-icon="inline-end"
                            className={showPlaybook ? "rotate-180 transition-transform" : "transition-transform"}
                          />
                        </Button>
                      </div>
                      {showPlaybook ? (
                        <div id="design-playbook-details" className="mt-3">
                          <DevinPlaybookCard variant="compact" />
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
                {choiceLocked ? (
                  <Alert>
                    <Lock />
                    <AlertTitle>Your print request is locked in</AlertTitle>
                    <AlertDescription>
                      An organizer has accepted it into the print queue. You can still change your competition entry
                      while submissions are open.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {needsDesignPick ? (
                  <Alert>
                    <Trophy />
                    <AlertTitle>Enter a design in the competition</AlertTitle>
                    <AlertDescription>
                      You don&apos;t have a competition entry right now. Pick one of your uploads to put it in the vote.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {needsPrintPick ? (
                  <Alert>
                    <Printer />
                    <AlertTitle>Pick your print request</AlertTitle>
                    <AlertDescription>
                      Your print request was sent back, so nothing is waiting to print. Request a print of your other
                      upload{open ? ", or upload a new design" : ""}. Your competition entry stays in the vote.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {sorted.map((s) => (
                  <SubmissionCard
                    key={s._id}
                    submission={s}
                    colours={settings.colours}
                    printers={settings.printers}
                    showPrintChoice={needsPrintPick || (open && active.length > 1)}
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
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
