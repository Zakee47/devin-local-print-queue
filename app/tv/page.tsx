import type { Metadata } from "next";
import TvScreen from "@/components/tv/TvScreen";

export const metadata: Metadata = { title: "Live print queue" };

// Full-screen live queue for the venue TV. Public, no sign-in.
export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { view } = await searchParams;
  return <TvScreen view={typeof view === "string" ? view : undefined} />;
}
