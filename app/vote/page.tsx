import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import VoteGallery from "@/components/vote/VoteGallery";

export default function VotePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader width="wide" />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <VoteGallery />
      </main>
      <SiteFooter width="wide" />
    </div>
  );
}
