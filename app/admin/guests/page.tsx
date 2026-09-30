import GuestsManager from "@/components/admin/GuestsManager";

export default function AdminGuestsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em]">Guests</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The Luma guest list decides who can register and submit a keychain.
        </p>
      </div>
      <GuestsManager />
    </div>
  );
}
