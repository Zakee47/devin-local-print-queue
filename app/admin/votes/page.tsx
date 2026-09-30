import VoteResults from "@/components/vote/VoteResults";
import AdminGate from "@/components/AdminGate";

export default function AdminVotesPage() {
  return (
    <AdminGate ownerOnly>
      <VoteResults />
    </AdminGate>
  );
}
