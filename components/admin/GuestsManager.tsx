"use client";

import { useRef, useState } from "react";
import { FileUp, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { parseGuestCsv } from "@/lib/guest-csv";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export default function GuestsManager() {
  const role = useQuery(api.admins.role);
  const latest = useQuery(api.guests.latestImport, role === "owner" ? {} : "skip");
  const guests = useQuery(api.guests.list, role === "owner" ? {} : "skip");
  const importCsv = useMutation(api.guests.importCsv);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  if (role === undefined) return <Skeleton className="h-20 rounded-xl" />;
  if (role !== "owner") {
    return (
      <Alert>
        <TriangleAlert />
        <AlertTitle>Only the event owner can manage the guest list.</AlertTitle>
      </Alert>
    );
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const parsed = parseGuestCsv(await file.text());
      if (parsed.guests.length === 0) throw new Error("No guests with an email found in that CSV");
      const res = await importCsv({
        fileName: file.name,
        rowCount: parsed.rowCount,
        hasCheckInColumn: parsed.hasCheckInColumn,
        guests: parsed.guests,
      });
      toast.success(`Imported ${res.total} guests, ${res.eligibleCount} eligible`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const q = search.trim().toLowerCase();
  const filtered =
    guests?.filter((g) => !q || g.email.includes(q) || g.name?.toLowerCase().includes(q)) ?? [];
  const registeredCount = guests?.filter((g) => g.registered).length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <Alert>
        <TriangleAlert />
        <AlertTitle>Uploading replaces the whole guest list</AlertTitle>
        <AlertDescription>
          Upload the Luma export with name and email columns. Each upload replaces the whole list;
          people who already registered keep their accounts.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          id="guest-csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          <FileUp data-icon="inline-start" />
          {uploading ? "Importing..." : "Upload the Luma export with name and email columns"}
        </Button>
        {latest ? (
          <span className="text-xs text-muted-foreground">
            Last import: <span className="font-mono">{latest.fileName}</span> by {latest.uploadedBy} ·{" "}
            {new Date(latest._creationTime).toLocaleString("en-GB")}
          </span>
        ) : null}
      </div>

      {latest === undefined ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : latest ? (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-3">
          <Stat label="CSV rows" value={latest.rowCount} />
          <Stat label="Eligible" value={latest.eligibleCount} />
          <Stat label="Registered" value={registeredCount} />
        </dl>
      ) : null}

      <div className="flex flex-col gap-3">
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search guests"
          />
        </InputGroup>
        {guests === undefined ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Checked in</th>
                  <th className="px-4 py-2 font-medium">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((g) => (
                  <tr key={g._id} className="transition-colors hover:bg-surface">
                    <td className="px-4 py-2">{g.name ?? <span className="text-muted-dim">–</span>}</td>
                    <td className="px-4 py-2 font-mono text-xs">{g.email}</td>
                    <td className="px-4 py-2">
                      {g.checkedIn ? <Badge variant="outline">Checked in</Badge> : <span className="text-muted-dim">No</span>}
                    </td>
                    <td className="px-4 py-2">
                      {g.registered ? <Badge variant="outline">Registered</Badge> : <span className="text-muted-dim">No</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      {guests.length === 0 ? "No guest list uploaded yet." : "No guests match."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
        {guests ? (
          <p className="text-xs text-muted-dim">
            Showing {filtered.length} of {guests.length} guests
          </p>
        ) : null}
      </div>
    </div>
  );
}
