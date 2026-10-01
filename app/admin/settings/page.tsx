import SettingsManager from "@/components/admin/SettingsManager";
import StaffSettingsSection from "@/components/admin/StaffSettingsSection";

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em]">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Submission window, printers, size limits and the colour palette.
        </p>
      </div>
      <SettingsManager />
      <StaffSettingsSection />
    </div>
  );
}
