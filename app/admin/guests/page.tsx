import GuestsManager from "@/components/admin/GuestsManager";

export default function AdminGuestsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em]">Guests</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload the Luma export with name and email columns.
        </p>
      </div>
      <GuestsManager />
    </div>
  );
}
