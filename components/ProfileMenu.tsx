"use client";

import { UserButton } from "@clerk/nextjs";

export default function ProfileMenu() {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action label="manageAccount" />
        <UserButton.Action label="signOut" />
      </UserButton.MenuItems>
    </UserButton>
  );
}
