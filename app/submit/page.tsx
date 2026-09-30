import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

// Placeholder: participant submission flow (Workstream A).
export default function SubmitPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="font-heading text-3xl font-semibold">My entries</h1>
      </main>
      <SiteFooter />
    </div>
  );
}
