"use client";

import { useState } from "react";
import { Crown, Download, Lock, LockOpen, Monitor, MonitorOff } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { downloadCsv } from "@/lib/csv";
import StageChip from "@/components/vote/StageChip";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/errors";
import { SETTINGS_HELP } from "@/lib/settings-help";
import SettingHelp from "@/components/admin/SettingHelp";

export default function VoteResults() {
  return <OwnerResults />;
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function OwnerResults() {
  const settings = useQuery(api.settings.get);
  const results = useQuery(api.votes.results);
  const update = useMutation(api.settings.update);
  const [saving, setSaving] = useState(false);

  const toggle = async (patch: {
    votingOpen?: boolean;
    showResultsOnTv?: boolean;
    tvDefaultView?: "main" | "projects";
  }) => {
    setSaving(true);
    try {
      await update(patch);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't update settings"));
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (!results) return;
    downloadCsv(`keychain-votes-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["rank", "votes", "likes", "skips", "print_code", "title", "stage", "colour", "username", "participant_name", "participant_email"],
      ...results.rows.map((r) => [
        String(r.rank),
        String(r.votes),
        String(r.likes),
        String(r.skips),
        r.printCode,
        r.title,
        r.stage,
        r.colour ?? "",
        r.displayName,
        r.participantName,
        r.participantEmail,
      ]),
    ]);
  };

  if (settings === undefined || results === undefined) return <ResultsSkeleton />;

  const turnout = results.participants ? Math.round((results.voters / results.participants) * 100) : 0;
  const totalVotes = results.rows.reduce((sum, r) => sum + r.votes, 0);
  const winner = results.winner;
  const winnerTieBroken = winner !== null && results.rows[1]?.tiedWithPrevious === true;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted-foreground">People&apos;s choice</p>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight">Votes</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
          {settings.votingOpen ? (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" disabled={saving} />}>
                <Lock data-icon="inline-start" />
                Close voting
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close voting?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This locks everyone&apos;s votes. Nobody can vote, change a vote, like or skip
                    until you open voting again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => toggle({ votingOpen: false })}>Close voting</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="brand" disabled={saving} onClick={() => toggle({ votingOpen: true })}>
              <LockOpen data-icon="inline-start" />
              Open voting
            </Button>
          )}
            <SettingHelp {...SETTINGS_HELP.voting} />
          </div>
          <div className="flex items-center gap-1">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => toggle({ showResultsOnTv: !settings.showResultsOnTv })}
          >
            {settings.showResultsOnTv ? <MonitorOff data-icon="inline-start" /> : <Monitor data-icon="inline-start" />}
            {settings.showResultsOnTv ? "Hide results on TV" : "Show results on TV"}
          </Button>
            <SettingHelp {...SETTINGS_HELP.showResultsOnTv} />
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              TV default view
              <SettingHelp {...SETTINGS_HELP.tvDefaultView} />
            </span>
            <ToggleGroup
              value={[settings.tvDefaultView ?? "main"]}
              onValueChange={(value) => {
                const next = value[0];
                if (next === "main" || next === "projects") void toggle({ tvDefaultView: next });
              }}
              disabled={saving}
              aria-label="TV default view"
              className="gap-1"
            >
              <ToggleGroupItem value="main" variant="outline" className="aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background hover:aria-pressed:bg-foreground hover:aria-pressed:text-background">
                {settings.showResultsOnTv ? "Winner" : "Print queue"}
              </ToggleGroupItem>
              <ToggleGroupItem value="projects" variant="outline" className="aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background hover:aria-pressed:bg-foreground hover:aria-pressed:text-background">
                Projects
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <dt className="eyebrow text-muted-dim">Voting</dt>
          <dd className="mt-2 flex items-center gap-2 font-heading text-xl font-medium">
            {settings.votingOpen ? "Open" : "Closed · locked"}
            {settings.showResultsOnTv ? <Badge variant="outline">On TV</Badge> : null}
          </dd>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <dt className="eyebrow text-muted-dim">Turnout</dt>
          <dd className="mt-2 font-heading text-xl font-medium tabular-nums">
            {results.voters} / {results.participants}{" "}
            <span className="text-sm text-muted-foreground">({turnout}%)</span>
          </dd>
          <Progress value={turnout} className="mt-3" aria-label="Voter turnout" />
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <dt className="eyebrow text-muted-dim">Votes cast</dt>
          <dd className="mt-2 font-heading text-xl font-medium tabular-nums">
            {totalVotes} <span className="text-sm text-muted-foreground">on {results.rows.length} competition entries</span>
          </dd>
        </div>
      </dl>

      {winner ? (
        <section
          aria-label="Winner"
          className="flex flex-wrap items-center gap-4 rounded-xl bg-brand/10 p-5 ring-2 ring-brand"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <Crown className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-muted-foreground">{settings.votingOpen ? "Leading" : "Winner"}</p>
            <p className="mt-1 truncate font-heading text-2xl font-semibold tracking-tight">{winner.title}</p>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground">{winner.displayName}</span> · {winner.participantName} ·{" "}
              {winner.participantEmail}
            </p>
          </div>
          <div className="text-right">
            <p className="font-heading text-2xl font-semibold tabular-nums">
              {winner.votes} vote{winner.votes === 1 ? "" : "s"}
            </p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {winner.likes} like{winner.likes === 1 ? "" : "s"} · <span className="font-mono">{winner.printCode}</span>
            </p>
            {winnerTieBroken ? (
              <p className="mt-1 text-xs text-muted-dim">Tied on votes and likes; broken by print code.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-medium">Ranking</h2>
            <p className="text-xs text-muted-foreground">Votes, then likes, then print code.</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={results.rows.length === 0}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        </div>
        {results.rows.length === 0 ? (
          <Empty className="border border-dashed border-border-strong py-16">
            <EmptyHeader>
              <EmptyTitle>No competition entries yet</EmptyTitle>
              <EmptyDescription>Designs appear here as soon as they&apos;re entered in the competition.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">#</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Votes</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Likes</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Skips</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Code</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Title</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Stage</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Participant</th>
                </tr>
              </thead>
              <tbody>
                {results.rows.map((r, i) => {
                  const isWinner = winner?.submissionId === r.submissionId;
                  const tied = r.tiedWithPrevious || results.rows[i + 1]?.tiedWithPrevious === true;
                  return (
                    <tr key={r.submissionId} className={cn("border-t border-border", isWinner && "bg-brand/10")}>
                      <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          {r.rank}
                          {isWinner ? <Crown className="size-3.5 text-brand" aria-label="Winner" /> : null}
                          {tied ? <span className="text-[0.7rem] text-muted-dim">tie</span> : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-heading text-base font-medium tabular-nums">{r.votes}</td>
                      <td className="px-4 py-3 tabular-nums">{r.likes}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.skips}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.printCode}</td>
                      <td className="px-4 py-3">{r.title}</td>
                      <td className="px-4 py-3">
                        <StageChip stage={r.stage} />
                      </td>
                      <td className="px-4 py-3">
                        <div>{r.displayName}</div>
                        <div className="text-xs text-muted-dim">
                          {r.participantName} · {r.participantEmail}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
