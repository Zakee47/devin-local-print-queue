"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function BlockedEmails({
  blocked,
  onUnblock,
}: {
  blocked: Doc<"blockedEmails">[] | undefined;
  onUnblock: (row: Doc<"blockedEmails">) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold tracking-[-0.01em]">
        Blocked emails
      </h2>
      {blocked === undefined ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : blocked.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blocked emails.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl ring-1 ring-border sm:block">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium">Blocked by</th>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {blocked.map((row) => (
                  <tr key={row._id} className="transition-colors hover:bg-surface">
                    <td className="px-4 py-2 font-mono text-xs">{row.email}</td>
                    <td className="px-4 py-2">
                      {row.reason ?? <span className="text-muted-dim">–</span>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{row.blockedBy}</td>
                    <td className="px-4 py-2 text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(row._creationTime).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="xs" onClick={() => onUnblock(row)}>
                        Unblock
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {blocked.map((row) => (
              <div
                key={row._id}
                className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-border"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 font-mono text-xs break-all">{row.email}</div>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="shrink-0"
                    onClick={() => onUnblock(row)}
                  >
                    Unblock
                  </Button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {row.reason ?? "No reason"} · blocked by{" "}
                    <span className="font-mono">{row.blockedBy}</span>
                  </span>
                  <span>
                    {new Date(row._creationTime).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
