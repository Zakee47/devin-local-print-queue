"use client";

import { useClerk, UserButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { eventHomeFor } from "@/lib/brand-home";

export default function ProfileMenu() {
  const { signOut } = useClerk();
  const pathname = usePathname();

  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action label="manageAccount" />
        <UserButton.Action
          label="Sign out"
          labelIcon={<LogOut className="size-4" />}
          onClick={() => signOut({ redirectUrl: eventHomeFor(pathname) })}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
