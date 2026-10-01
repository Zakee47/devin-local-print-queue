"use client";

import { ReactNode } from "react";
import { ShieldX } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function AdminGate({
  children,
  ownerOnly,
}: {
  children: ReactNode;
  ownerOnly?: boolean;
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const role = useQuery(api.admins.role, isAuthenticated ? {} : "skip");

  if (isLoading || (isAuthenticated && role === undefined)) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  if (!isAuthenticated || role === null || role === undefined) {
    const email = user?.primaryEmailAddress?.emailAddress;
    return (
      <Empty className="border border-dashed border-border-strong py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldX />
          </EmptyMedia>
          <EmptyTitle>Not an admin</EmptyTitle>
          <EmptyDescription>
            {email ? (
              <>
                You&apos;re signed in as{" "}
                <span className="text-foreground">{email}</span>,
                which isn&apos;t an organizer account.
              </>
            ) : (
              "Your account isn't an organizer account."
            )}{" "}
            Ask an existing organizer to add your email.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (ownerOnly && role !== "owner") {
    return (
      <Empty className="border border-dashed border-border-strong py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldX />
          </EmptyMedia>
          <EmptyTitle>Owner only</EmptyTitle>
          <EmptyDescription>
            Only the event owner can open this page.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <>{children}</>;
}
