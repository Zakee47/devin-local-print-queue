"use client";

import type { ComponentProps } from "react";
import { usePathname } from "next/navigation";
import { SignInButton } from "@clerk/nextjs";
import { eventHomeFor } from "@/lib/brand-home";

export default function EventSignInButton(props: ComponentProps<typeof SignInButton>) {
  const pathname = usePathname();
  const returnTo = pathname && pathname !== "/" ? pathname : eventHomeFor(pathname);
  return (
    <SignInButton mode="modal" fallbackRedirectUrl={returnTo} signUpFallbackRedirectUrl={returnTo} {...props} />
  );
}
