import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

// Placeholder: voting gallery (Workstream D).
export default function VotePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader width="wide" />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="font-heading text-3xl font-semibold">Vote</h1>
      </main>
      <SiteFooter width="wide" />
    </div>
  );
}
