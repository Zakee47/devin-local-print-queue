import { EVENT_HOME } from "@/lib/event";

export const SITE_TITLE = "Devin Local";
export const SITE_DESCRIPTION =
  "Devin Local is Cognition's series of co-working sessions for engineers, founders, designers and operators.";
export const OG_IMAGE = "/landing/og.png";

export const LUMA_CALENDAR = "https://luma.com/Cognition-london";
export const RECAP_YOUTUBE_ID = "l_PUj9FA5Gs";
export const LONDON_EVENT_HREF = EVENT_HOME;

export const LINKS = {
  cognition: "https://cognition.ai",
  devin: "https://devin.ai",
  cognitionX: "https://x.com/cognition",
  cognitionLinkedIn: "https://www.linkedin.com/company/cognition-ai-labs",
  devinX: "https://x.com/DevinAI",
};

export const NAV_ITEMS = [
  { href: "#london", label: "Events" },
  { href: "#about", label: "What is Devin Local" },
  { href: "#recap", label: "Recap" },
  { href: "#social", label: "Testimonials" },
  { href: "#faq", label: "FAQ" },
] as const;

export const ABOUT_PHOTOS = [
  { id: "DSC03263", alt: "The rooftop crowd at Devin Local London" },
  { id: "DSC03421", alt: "Builders co-working at long tables" },
  { id: "DSC03598", alt: "Two builders looking at a laptop together" },
  { id: "DSC03651", alt: "The crowd on the roof terrace at night" },
] as const;

export type SocialMedia = {
  type: "image" | "video";
  src: string;
  width?: number | null;
  height?: number | null;
  poster?: string;
  alt?: string;
};

export type SocialPost = {
  id: string;
  platform: "x" | "linkedin" | "instagram" | string;
  url: string;
  date: string;
  author: { name: string; handle?: string | null; avatar: string };
  text: string;
  featured: boolean;
  featuredRank?: number | null;
  media: SocialMedia[];
};

// 35 event photos for the closing collage, 600px wide, under public/landing/collage.
export const COLLAGE = [
  "DSC03244", "DSC03253", "DSC03263", "DSC03267", "DSC03269", "DSC03277", "DSC03297",
  "DSC03298", "DSC03308", "DSC03311", "DSC03334", "DSC03343", "DSC03345", "DSC03352",
  "DSC03355", "DSC03368", "DSC03369", "DSC03392", "DSC03402", "DSC03409", "DSC03412",
  "DSC03432", "DSC03446", "DSC03465", "DSC03476", "DSC03487", "DSC03488", "DSC03527",
  "DSC03572", "DSC03651", "DSC03691", "DSC03696", "DSC03766", "DSC03771", "DSC03811",
];

// Collage slots: [left %, top %, scroll speed, width px].
export type Slot = [number, number, number, number];
export const SLOTS_DESKTOP: Slot[] = [
  [-3, 2, 0.27, 240], [14, 2, 0.27, 200], [29, 2, 0.18, 260], [52, -1, 0.1, 220], [67.5088, -2, 0.2, 180], [86, 1, 0.29, 260],
  [4, 13, 0.22, 260], [22.3158, 12.0744, 0.18, 200], [73, 12, 0.25, 220],
  [-5, 28, 0.19, 180], [14, 28, 0.17, 260], [70, 26, 0.24, 220], [88, 27, 0.19, 180],
  [-1, 44, 0.25, 240], [16, 42, 0.17, 180], [39, 40, 0.13, 180], [54, 43, 0.29, 240], [72, 40, 0.2, 200], [93, 42, 0.15, 220],
  [12, 55, 0.24, 180], [28, 57, 0.26, 200], [46.6842, 58, 0.12, 260], [65, 55, 0.17, 240], [82, 57, 0.17, 200],
  [-1, 70, 0.27, 260], [18, 68, 0.13, 240], [38.2982, 72, 0.22, 180], [51, 69, 0.13, 220], [90, 68, 0.1, 200],
  [-2.8246, 83, 0.08, 220], [12.6842, 86, 0.18, 260], [31, 86, 0.11, 240], [47.9123, 83, 0.15, 200], [68.8947, 86, 0.13, 200], [83, 86, 0.12, 240],
];
export const SLOTS_MOBILE: Slot[] = [
  [-6, 1, 0.19, 130], [60, 2, 0.22, 130], [2, 11, 0.21, 150], [66, 11, 0.259, 150], [-6, 22, 0.11, 130], [60, 25, 0.13, 140],
  [2, 35, 0.22, 140], [66, 33, 0.1234, 140], [-6, 47, 0.2, 140], [60, 44, 0.13, 150], [2, 57, 0.25, 140], [66, 56, 0.2, 130],
  [-6, 68, 0.2009, 150], [60, 66, 0.25, 140], [2, 77, 0.24, 140], [66, 79, 0.28, 140], [-6, 89, 0.21, 150], [60, 90, 0.23, 150],
];
