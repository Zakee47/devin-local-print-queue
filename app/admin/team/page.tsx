import AdminGate from "@/components/AdminGate";
import TeamManager from "@/components/admin/team/TeamManager";

export default function AdminTeamPage() {
  return (
    <AdminGate ownerOnly>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em]">Team</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Staff can manage the print queue and settings. Only you can see participant
            details, manage voting and change the team.
          </p>
        </div>
        <TeamManager />
      </div>
    </AdminGate>
  );
}
