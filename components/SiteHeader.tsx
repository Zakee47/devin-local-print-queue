import Link from "next/link";
import { Tv } from "lucide-react";
import { BrandWordmark } from "@/components/BrandMark";
import HeaderAuth from "@/components/HeaderAuth";
import HeaderBar from "@/components/HeaderBar";
import NoticeBanner from "@/components/NoticeBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import HelpTour from "@/components/tutorial/HelpTour";
import { getAppName } from "@/lib/app-name";
import { PAGE_WIDTHS, type PageWidth } from "@/lib/page-width";
import { cn } from "@/lib/utils";

export default function SiteHeader({
  width = "default",
  showSignIn = true,
}: {
  width?: PageWidth;
  // Pages with their own sign-in CTA (the home hero) drop the header's.
  showSignIn?: boolean;
}) {
  return (
    <HeaderBar>
      <div
        className={cn(
          "mx-auto flex h-15.25 items-center justify-between gap-4 px-4 sm:px-6",
          PAGE_WIDTHS[width]
        )}
      >
        <Link
          href="/"
          aria-label={`${getAppName()} home`}
          className="group flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <BrandWordmark />
        </Link>
        <nav aria-label="Account" className="flex shrink-0 items-center gap-2">
          <Link
            href="/tv"
            aria-label="TV mode"
            title="TV mode"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Tv aria-hidden className="size-4.5" />
          </Link>
          <HelpTour tour="participant" autoOpenPath="/submit" />
          <ThemeToggle />
          <HeaderAuth showSignIn={showSignIn} />
        </nav>
      </div>
      <NoticeBanner width={width} />
    </HeaderBar>
  );
}
