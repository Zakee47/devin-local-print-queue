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
        <div className="overflow-x-auto rounded-xl ring-1 ring-border">
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
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(row._creationTime).toLocaleString("en-GB")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onUnblock(row)}
                    >
                      Unblock
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
