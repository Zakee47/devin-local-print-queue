import AdminGate from "@/components/AdminGate";
import CheckinScanner from "@/components/admin/CheckinScanner";

export default function AdminCheckinPage() {
  return (
    <AdminGate ownerOnly>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em]">Luma check-in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Scan a guest ticket QR to check them in on Luma.
          </p>
        </div>
        <CheckinScanner />
      </div>
    </AdminGate>
  );
}
