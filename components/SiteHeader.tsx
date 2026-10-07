import Link from "next/link";
import { Tv } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { CognitionLogo, DevinLogo } from "@/components/landing/Logos";
import HeaderAuth from "@/components/HeaderAuth";
import HeaderBar from "@/components/HeaderBar";
import NoticeBanner from "@/components/NoticeBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import HelpTour from "@/components/tutorial/HelpTour";
import { EVENT_HOME, EVENT_TITLE } from "@/lib/event";
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
          "relative mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6",
          PAGE_WIDTHS[width]
        )}
      >
        <Link
          href={EVENT_HOME}
          aria-label={`${EVENT_TITLE} home`}
          className="group flex shrink-0 items-center rounded-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="hidden items-center gap-3 sm:flex">
            <CognitionLogo className="h-4.5 w-auto" />
            <span aria-hidden="true" className="h-5 w-px bg-border" />
            <DevinLogo className="h-4.5 w-auto" />
          </span>
          <span className="flex items-center gap-1.5 sm:hidden">
            <BrandMark className="size-6" />
            <span className="whitespace-nowrap font-heading text-sm font-semibold tracking-tight">{EVENT_TITLE}</span>
          </span>
        </Link>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 font-heading text-lg font-semibold tracking-tight sm:block"
        >
          {EVENT_TITLE}
        </span>
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
