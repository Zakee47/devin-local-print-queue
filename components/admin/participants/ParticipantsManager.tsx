"use client";

import { useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { STATUS_LABELS } from "@/lib/event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useUndoableRemoval } from "@/components/admin/useUndoableRemoval";
import { cn } from "@/lib/utils";
import RenameDialog from "./RenameDialog";
import DeleteDialog from "./DeleteDialog";
import BlockedEmails from "./BlockedEmails";
import { errorMessage } from "@/lib/errors";

const STATUS_TONES: Record<keyof typeof STATUS_LABELS, string> = {
  submitted: "border-border bg-muted text-muted-foreground",
  queued: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  printing: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  done: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  rejected: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
};

export type ParticipantRow = {
  _id: Id<"participants">;
  username: string;
  name: string;
  email: string;
  registeredAt: number;
  entry: { printCode: string; title: string; status: keyof typeof STATUS_LABELS } | null;
  uploadCount: number;
  votesCast: number;
  votesReceived: number;
  likesReceived: number;
};

function EntryCell({ entry }: { entry: ParticipantRow["entry"] }) {
  if (!entry) return <span className="text-muted-dim">No entry</span>;
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
        <span className="font-mono text-xs">{entry.printCode}</span>
        <span className="min-w-0 break-words">{entry.title}</span>
      </span>
      <Badge variant="outline" className={cn("rounded-full", STATUS_TONES[entry.status])}>
        {STATUS_LABELS[entry.status]}
      </Badge>
    </div>
  );
}

export default function ParticipantsManager() {
  const participants = useQuery(api.accounts.listParticipants);
  const blocked = useQuery(api.accounts.listBlocked);
  const deleteParticipant = useMutation(api.accounts.deleteParticipant);
  const unblock = useMutation(api.accounts.unblock);
  const { pending, schedule } = useUndoableRemoval();
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<ParticipantRow | null>(null);
  const [deleting, setDeleting] = useState<ParticipantRow | null>(null);

  const q = search.trim().toLowerCase();
  const filtered =
    participants?.filter(
      (p) =>
        !pending.has(p._id) &&
        (!q ||
          p.username.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.entry?.printCode.toLowerCase().includes(q))
    ) ?? [];

  async function handleUnblock(row: Doc<"blockedEmails">) {
    try {
      await unblock({ id: row._id });
      toast.success(`${row.email} unblocked`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't unblock"));
    }
  }

  function handleDeleteConfirm({ block, reason }: { block: boolean; reason?: string }) {
    if (!deleting) return;
    const participant = deleting;
    schedule({
      id: participant._id,
      label: participant.username,
      run: () =>
        deleteParticipant({
          participantId: participant._id,
          block,
          reason,
        }),
      errorFallback: "Couldn't delete",
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, name, email or print code"
            aria-label="Search participants"
          />
        </InputGroup>

        {participants === undefined ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl ring-1 ring-border lg:block">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-surface text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-[25%] px-4 py-2 font-medium">Participant</th>
                    <th className="w-[18%] px-4 py-2 font-medium">Registered</th>
                    <th className="px-4 py-2 font-medium">Entry</th>
                    <th className="w-[18%] px-4 py-2 text-right font-medium">Activity</th>
                    <th className="w-24 px-4 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => (
                    <tr key={p._id} className="transition-colors hover:bg-surface">
                      <td className="min-w-0 px-4 py-2">
                        <div className="font-medium">{p.username}</div>
                        <div className="text-xs text-muted-foreground">{p.name}</div>
                        <div className="break-all font-mono text-xs text-muted-foreground">
                          {p.email}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(p.registeredAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2">
                        <EntryCell entry={p.entry} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="whitespace-nowrap text-xs tabular-nums">
                          {p.uploadCount} <span className="text-muted-foreground">uploads</span> · {p.votesCast}{" "}
                          <span className="text-muted-foreground">cast</span>
                        </div>
                        <div className="whitespace-nowrap text-xs tabular-nums">
                          {p.votesReceived} <span className="text-muted-foreground">votes</span> · {p.likesReceived}{" "}
                          <span className="text-muted-foreground">likes</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Rename ${p.username}`}
                            title={`Rename ${p.username}`}
                            onClick={() => setRenaming(p)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-destructive"
                            aria-label={`Delete ${p.username}`}
                            title={`Delete ${p.username}`}
                            onClick={() => setDeleting(p)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        {participants.length === 0
                          ? "No one has registered yet."
                          : "No participants match."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 lg:hidden">
              {filtered.map((p) => (
                <div
                  key={p._id}
                  className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="min-w-0 truncate font-medium">{p.username}</div>
                      <div className="text-xs text-muted-foreground">{p.name}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {p.email}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="xs" onClick={() => setRenaming(p)}>
                        Rename
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-destructive"
                        onClick={() => setDeleting(p)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <EntryCell entry={p.entry} />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Registered {new Date(p.registeredAt).toLocaleString("en-GB")}</span>
                    <span>{p.uploadCount} uploads</span>
                    <span>{p.votesCast} votes cast</span>
                    <span>{p.votesReceived} votes</span>
                    <span>{p.likesReceived} likes</span>
                  </div>
                </div>
              ))}
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {participants.length === 0
                    ? "No one has registered yet."
                    : "No participants match."}
                </p>
              ) : null}
            </div>

            <p className="text-xs text-muted-dim">
              Showing {filtered.length} of {participants.length} participants
            </p>
          </>
        )}
      </div>

      <BlockedEmails blocked={blocked} onUnblock={handleUnblock} />

      <RenameDialog
        participant={renaming}
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
      />
      <DeleteDialog
        participant={deleting}
        open={deleting !== null}
        onConfirm={handleDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}
