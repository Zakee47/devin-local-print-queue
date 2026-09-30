import type { Metadata } from "next";
import TvBoard from "@/components/tv/TvBoard";

export const metadata: Metadata = { title: "Live print queue" };

// Full-screen live queue for the venue TV. Public, no sign-in.
export default function TvPage() {
  return <TvBoard />;
}
