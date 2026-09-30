"use client";

import { useState } from "react";
import { Download, Lock, LockOpen, Monitor, MonitorOff } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { downloadCsv } from "@/lib/csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function VoteResults() {
  const settings = useQuery(api.settings.get);
  const results = useQuery(api.votes.results);
  const update = useMutation(api.settings.update);
  const [saving, setSaving] = useState(false);

  const toggle = async (patch: { votingOpen?: boolean; showResultsOnTv?: boolean }) => {
    setSaving(true);
    try {
      await update(patch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update settings");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (!results) return;
    downloadCsv(`keychain-votes-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["rank", "votes", "print_code", "title", "colour", "participant_name", "participant_email"],
      ...results.rows.map((r) => [
        String(r.rank),
        String(r.votes),
        r.printCode,
        r.title,
        r.colour ?? "",
        r.participantName,
        r.participantEmail,
      ]),
    ]);
  };

  if (settings === undefined || results === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const turnout = results.participants
    ? Math.round((results.voters / results.participants) * 100)
    : 0;
  const totalVotes = results.rows.reduce((sum, r) => sum + r.votes, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted-foreground">People&apos;s choice</p>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight">Votes</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={settings.votingOpen ? "outline" : "brand"}
            disabled={saving}
            onClick={() => toggle({ votingOpen: !settings.votingOpen })}
          >
            {settings.votingOpen ? <Lock data-icon="inline-start" /> : <LockOpen data-icon="inline-start" />}
            {settings.votingOpen ? "Close voting" : "Open voting"}
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => toggle({ showResultsOnTv: !settings.showResultsOnTv })}
          >
            {settings.showResultsOnTv ? (
              <MonitorOff data-icon="inline-start" />
            ) : (
              <Monitor data-icon="inline-start" />
            )}
            {settings.showResultsOnTv ? "Hide results on TV" : "Show results on TV"}
          </Button>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <dt className="eyebrow text-muted-dim">Voting</dt>
          <dd className="mt-2 flex items-center gap-2 font-heading text-xl font-medium">
            {settings.votingOpen ? "Open" : "Closed"}
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
            {totalVotes}{" "}
            <span className="text-sm text-muted-foreground">on {results.rows.length} entries</span>
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-lg font-medium">Results</h2>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={results.rows.length === 0}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        </div>
        {results.rows.length === 0 ? (
          <Empty className="border border-dashed border-border-strong py-16">
            <EmptyHeader>
              <EmptyTitle>No printed entries yet</EmptyTitle>
              <EmptyDescription>Entries appear here once they&apos;re marked done.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">#</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Votes</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Code</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Title</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Participant</th>
                </tr>
              </thead>
              <tbody>
                {results.rows.map((r) => (
                  <tr key={r.submissionId} className="border-t border-border">
                    <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">{r.rank}</td>
                    <td className="px-4 py-3 font-heading text-base font-medium tabular-nums">{r.votes}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.printCode}</td>
                    <td className="px-4 py-3">{r.title}</td>
                    <td className="px-4 py-3">
                      <div>{r.participantName}</div>
                      <div className="text-xs text-muted-dim">{r.participantEmail}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
