import AdminGate from "@/components/AdminGate";
import ParticipantsManager from "@/components/admin/participants/ParticipantsManager";

export default function AdminParticipantsPage() {
  return (
    <AdminGate ownerOnly>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em]">
            Participants
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Registered accounts, their entries and activity. Rename or remove accounts
            and block emails from re-registering.
          </p>
        </div>
        <ParticipantsManager />
      </div>
    </AdminGate>
  );
}
