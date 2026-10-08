"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useViewerAuth } from "@/lib/use-viewer-auth";
import EventSignInButton from "@/components/EventSignInButton";
import ProfileMenu from "@/components/ProfileMenu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function HeaderAuth({
  showSignIn = true,
}: {
  showSignIn?: boolean;
}) {
  const { authReady, signedIn, canQuery } = useViewerAuth();
  const access = useQuery(api.admins.isAdmin, canQuery ? {} : "skip");

  // Hold the skeleton until `access` resolves too, otherwise the header renders
  // without the Admin button and then reflows once the query lands.
  if (!authReady || (signedIn && access === undefined)) {
    return <Skeleton className="h-7 w-20 rounded-md" />;
  }

  if (!signedIn) {
    if (!showSignIn) return null;
    return (
      <EventSignInButton>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-transparent dark:hover:bg-transparent"
        >
          Sign in
          <ArrowRight
            data-icon="inline-end"
            aria-hidden
            className="text-muted-dim transition-all group-hover/button:translate-x-0.5 group-hover/button:text-foreground"
          />
        </Button>
      </EventSignInButton>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:bg-transparent dark:hover:bg-transparent"
        render={<Link href="/submit" />}
        nativeButton={false}
      >
        My entries
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:bg-transparent dark:hover:bg-transparent"
        render={<Link href="/vote" />}
        nativeButton={false}
      >
        Vote
      </Button>
      {access ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-transparent dark:hover:bg-transparent"
          render={<Link href="/admin" />}
          nativeButton={false}
        >
          Admin
        </Button>
      ) : null}
      <ProfileMenu />
    </div>
  );
}
