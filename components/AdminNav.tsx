"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const STAFF_LINKS = [
  { href: "/admin", label: "Queue" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/tv", label: "TV" },
];

const OWNER_LINKS = [
  { href: "/admin", label: "Queue" },
  { href: "/admin/guests", label: "Guests" },
  { href: "/admin/participants", label: "Participants" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/votes", label: "Votes" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/tv", label: "TV" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const role = useQuery(api.admins.role, isAuthenticated ? {} : "skip");
  const links = role === "owner" ? OWNER_LINKS : STAFF_LINKS;

  return (
    <nav aria-label="Admin" className="flex items-center gap-1">
      {links.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 font-mono text-[0.8rem] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:px-3",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
