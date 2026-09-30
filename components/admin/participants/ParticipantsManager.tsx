"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { STATUS_LABELS } from "@/lib/event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import RenameDialog from "./RenameDialog";
import DeleteDialog from "./DeleteDialog";
import BlockedEmails from "./BlockedEmails";

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
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-xs">{entry.printCode}</span>
      <span className="truncate">{entry.title}</span>
      <Badge variant="outline">{STATUS_LABELS[entry.status]}</Badge>
    </span>
  );
}

export default function ParticipantsManager() {
  const participants = useQuery(api.accounts.listParticipants);
  const blocked = useQuery(api.accounts.listBlocked);
  const unblock = useMutation(api.accounts.unblock);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<ParticipantRow | null>(null);
  const [deleting, setDeleting] = useState<ParticipantRow | null>(null);

  const q = search.trim().toLowerCase();
  const filtered =
    participants?.filter(
      (p) =>
        !q ||
        p.username.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.entry?.printCode.toLowerCase().includes(q)
    ) ?? [];

  async function handleUnblock(row: Doc<"blockedEmails">) {
    try {
      await unblock({ id: row._id });
      toast.success(`${row.email} unblocked`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't unblock");
    }
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
            <div className="hidden overflow-x-auto rounded-xl ring-1 ring-border sm:block">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Username</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Registered</th>
                    <th className="px-4 py-2 font-medium">Entry</th>
                    <th className="px-4 py-2 text-right font-medium">Uploads</th>
                    <th className="px-4 py-2 text-right font-medium">Votes cast</th>
                    <th className="px-4 py-2 text-right font-medium">Votes</th>
                    <th className="px-4 py-2 text-right font-medium">Likes</th>
                    <th className="px-4 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => (
                    <tr key={p._id} className="transition-colors hover:bg-surface">
                      <td className="px-4 py-2 font-medium">{p.username}</td>
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2 font-mono text-xs">{p.email}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(p.registeredAt).toLocaleString("en-GB")}
                      </td>
                      <td className="px-4 py-2">
                        <EntryCell entry={p.entry} />
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.uploadCount}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.votesCast}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.votesReceived}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.likesReceived}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
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
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                        {participants.length === 0
                          ? "No one has registered yet."
                          : "No participants match."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 sm:hidden">
              {filtered.map((p) => (
                <div
                  key={p._id}
                  className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{p.username}</div>
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
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}
