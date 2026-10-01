import type { Metadata } from "next";
import TvBoard from "@/components/tv/TvBoard";
import TvDesignsBoard from "@/components/tv/TvDesignsBoard";

export const metadata: Metadata = { title: "Live print queue" };

// Full-screen live queue for the venue TV. Public, no sign-in.
export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { view } = await searchParams;
  return view === "designs" ? <TvDesignsBoard /> : <TvBoard />;
}
