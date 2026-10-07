import { IBM_Plex_Sans } from "next/font/google";

// The landing page uses IBM Plex Sans (the event app keeps General Sans).
export const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});
