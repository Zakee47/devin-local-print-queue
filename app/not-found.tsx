import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16 sm:px-6"
      >
        <p className="eyebrow text-muted-foreground">404 · Page not found</p>
        <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.02em]">
          We couldn&apos;t find that page.
        </h1>
        <p className="mt-3 max-w-lg text-sm text-muted-foreground">
          Check the address or head back to the keychain print queue.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "brand" }), "mt-6 w-fit")}
        >
          Back to the queue
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
