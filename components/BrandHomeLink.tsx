"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { brandHomeHref } from "@/lib/brand-home";
import { EVENT_TITLE } from "@/lib/event";

export default function BrandHomeLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const href = brandHomeHref(usePathname());

  return (
    <Link
      href={href}
      aria-label={href === "/" ? "Devin Local home" : `${EVENT_TITLE} home`}
      className={className}
    >
      {children}
    </Link>
  );
}
