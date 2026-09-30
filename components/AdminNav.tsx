"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function AdminNav() {
  const pathname = usePathname();
  const links = [
    { href: "/admin", label: "Queue" },
    { href: "/admin/guests", label: "Guests" },
    { href: "/admin/votes", label: "Votes" },
    { href: "/admin/settings", label: "Settings" },
    { href: "/tv", label: "TV" },
  ];

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
