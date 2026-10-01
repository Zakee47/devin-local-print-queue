"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, UserPlus } from "lucide-react";
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
import { errorMessage } from "@/lib/errors";

export default function TeamManager() {
  const team = useQuery(api.accounts.team);
  const addAdmin = useMutation(api.admins.add);
  const removeAdmin = useMutation(api.admins.remove);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Id<"admins"> | null>(null);

  const staffEmails = new Set(team?.staff.map((s) => s.email) ?? []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    if (normalized === team?.ownerEmail) {
      toast.error("That's your own email — you're already the owner");
      return;
    }
    if (staffEmails.has(normalized)) {
      toast.error("That email is already on the team");
      return;
    }
    setAdding(true);
    try {
      await addAdmin({ email: normalized });
      toast.success(`${normalized} added as staff`);
      setEmail("");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't add staff"));
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: Id<"admins">, staffEmail: string) {
    setRemoving(id);
    try {
      await removeAdmin({ id });
      toast.success(`${staffEmail} removed`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't remove staff"));
    } finally {
      setRemoving(null);
    }
  }

  if (team === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-x-auto rounded-xl ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="transition-colors hover:bg-surface">
              <td className="px-4 py-2 font-mono text-xs">{team.ownerEmail}</td>
              <td className="px-4 py-2">
                <Badge>Owner</Badge>
              </td>
              <td className="px-4 py-2 text-right text-muted-dim">–</td>
            </tr>
            {team.staff.map((staff) => (
              <tr key={staff._id} className="transition-colors hover:bg-surface">
                <td className="px-4 py-2 font-mono text-xs">{staff.email}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline">Staff</Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button variant="ghost" size="xs" disabled={removing === staff._id} />
                      }
                    >
                      Remove
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {staff.email}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          They will lose access to the admin queue and settings. Their Clerk
                          account is not affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => void remove(staff._id, staff.email)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {team.staff.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No staff yet — add a teammate by email below.
          </p>
        ) : null}
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <Mail />
          </InputGroupAddon>
          <InputGroupInput
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            aria-label="Staff email"
          />
        </InputGroup>
        <Button type="submit" disabled={adding || !email.trim()}>
          <UserPlus data-icon="inline-start" />
          Add staff
        </Button>
      </form>
    </div>
  );
}
