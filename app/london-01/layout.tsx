import type { Metadata } from "next";
import { OG_IMAGE } from "@/components/landing/data";

const TITLE = "Devin Local London #01";
const DESCRIPTION =
  "The event app for Devin Local London #01: design a keychain with Devin, submit it for printing and vote for your favourites.";

export const metadata: Metadata = {
  applicationName: "Devin Local",
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Devin Local",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Devin Local" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function London01Layout({ children }: { children: React.ReactNode }) {
  return children;
}
