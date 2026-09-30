"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";

export default function RoleBadge() {
  const { isAuthenticated } = useConvexAuth();
  const role = useQuery(api.admins.role, isAuthenticated ? {} : "skip");
  const label = role === "owner" ? "Owner" : role === "staff" ? "Staff" : "Admin";
  return (
    <Badge variant="outline" className="shrink-0">
      {label}
    </Badge>
  );
}
