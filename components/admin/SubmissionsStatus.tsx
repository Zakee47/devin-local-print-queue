"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { submissionsStatusText } from "@/components/admin/countdown";
import { useNow } from "@/components/admin/use-now";

export default function SubmissionsStatus() {
  const settings = useQuery(api.settings.get);
  const now = useNow();

  if (!settings) return <Skeleton className="h-10 rounded-xl" />;

  return (
    <div className="flex flex-col gap-3">
      <Alert variant={settings.submissionsAcceptingNow ? undefined : "destructive"}>
        <AlertTitle>{submissionsStatusText(settings, now)}</AlertTitle>
      </Alert>
    </div>
  );
}
