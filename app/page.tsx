import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_TITLE } from "@/components/landing/data";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Devin Local" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function Home() {
  return <LandingPage />;
}
