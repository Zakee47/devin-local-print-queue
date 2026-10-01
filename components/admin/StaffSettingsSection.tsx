"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import TeamManager from "@/components/admin/team/TeamManager";
import { Separator } from "@/components/ui/separator";

// Owner-only staff management, embedded at the bottom of Settings. Staff must
// not even mount TeamManager (api.accounts.team is owner-only).
export default function StaffSettingsSection() {
  const role = useQuery(api.admins.role);
  if (role !== "owner") return null;
  return (
    <>
      <Separator />
      <section className="grid gap-4 sm:grid-cols-[14rem_1fr] sm:gap-8">
        <div>
          <h2 className="font-heading text-base font-medium tracking-tight">
            Staff (print managers)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Staff can run the print queue, export files and change settings. Attendees are managed
            under Guests.
          </p>
        </div>
        <div className="min-w-0">
          <TeamManager />
        </div>
      </section>
    </>
  );
}
