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

export type Scatter = { id: string; x: number; y: number; w: number; range: number };

export const COPY_COLUMN_DESKTOP = { left: 16.4, right: 83.6 };

export const SCATTER_DESKTOP: Scatter[] = [
  { id: "DSC03244", x: -3, y: 2.5263, w: 16.8421, range: 2.16 },
  { id: "DSC03253", x: 2.3649, y: 30.8181, w: 14.0351, range: 2.16 },
  { id: "DSC03263", x: -1.8456, y: 16.2044, w: 18.2456, range: 1.44 },
  { id: "DSC03267", x: 83.6, y: 8.5047, w: 15.4386, range: 0.8 },
  { id: "DSC03269", x: 83.6, y: -2.5263, w: 12.6316, range: 1.6 },
  { id: "DSC03277", x: 86, y: 22.8471, w: 18.2456, range: 2.32 },
  { id: "DSC03297", x: -1.8456, y: 56.5116, w: 18.2456, range: 1.76 },
  { id: "DSC03298", x: 2.3649, y: 44.0649, w: 14.0351, range: 0.72 },
  { id: "DSC03308", x: 83.6, y: 36.6609, w: 15.4386, range: 2 },
  { id: "DSC03311", x: -5, y: 70.1653, w: 12.6316, range: 1.52 },
  { id: "DSC03334", x: -1.8456, y: 79.9164, w: 18.2456, range: 1.36 },
  { id: "DSC03343", x: 83.6, y: 48.1233, w: 15.4386, range: 1.92 },
  { id: "DSC03345", x: 88, y: 60.2257, w: 12.6316, range: 1.52 },
  { id: "DSC03352", x: -1, y: 114.5122, w: 16.8421, range: 2 },
  { id: "DSC03355", x: 3.7683, y: 103.8012, w: 12.6316, range: 1.36 },
  { id: "DSC03368", x: 3.7683, y: 93.7301, w: 12.6316, range: 1.04 },
  { id: "DSC03369", x: 83.6, y: 94.6858, w: 16.8421, range: 2.4 },
  { id: "DSC03392", x: 83.6, y: 69.8167, w: 14.0351, range: 1.6 },
  { id: "DSC03402", x: 93, y: 80.9835, w: 15.4386, range: 1.2 },
  { id: "DSC03409", x: 3.7683, y: 126.9103, w: 12.6316, range: 1.92 },
  { id: "DSC03412", x: 2.3649, y: 136.6613, w: 14.0351, range: 2.08 },
  { id: "DSC03432", x: 83.6, y: 132.4087, w: 18.2456, range: 0.96 },
  { id: "DSC03446", x: 83.6, y: 109.0039, w: 16.8421, range: 1.36 },
  { id: "DSC03465", x: 83.6, y: 121.242, w: 14.0351, range: 1.36 },
  { id: "DSC03476", x: -1.8456, y: 163.5861, w: 18.2456, range: 2.16 },
  { id: "DSC03487", x: -0.4421, y: 149.1081, w: 16.8421, range: 1.04 },
  { id: "DSC03488", x: 3.7683, y: 177.5599, w: 12.6316, range: 1.76 },
  { id: "DSC03527", x: 83.6, y: 156.7492, w: 15.4386, range: 1.04 },
  { id: "DSC03572", x: 90, y: 145.9025, w: 14.0351, range: 0.8 },
  { id: "DSC03651", x: -2, y: 189.2309, w: 15.4386, range: 0.64 },
  { id: "DSC03691", x: -1.8456, y: 202.1333, w: 18.2456, range: 1.44 },
  { id: "DSC03696", x: -0.4421, y: 216.4271, w: 16.8421, range: 0.88 },
  { id: "DSC03766", x: 83.6, y: 168.3716, w: 14.0351, range: 1.2 },
  { id: "DSC03771", x: 83.6, y: 179.0583, w: 14.0351, range: 1.04 },
  { id: "DSC03811", x: 83.6, y: 189.585, w: 16.8421, range: 0.96 },
];

export const SCATTER_MOBILE: Scatter[] = [
  { id: "DSC03244", x: 0, y: 3.6111, w: 36.1111, range: 1.52 },
  { id: "DSC03253", x: 60, y: 7.2222, w: 36.1111, range: 1.76 },
  { id: "DSC03263", x: 2, y: 39.7222, w: 41.6667, range: 1.68 },
  { id: "DSC03267", x: 58.3333, y: 39.7222, w: 41.6667, range: 2.32 },
  { id: "DSC03269", x: 0, y: 79.4444, w: 36.1111, range: 0.88 },
  { id: "DSC03277", x: 60, y: 90.2778, w: 38.8889, range: 1.04 },
  { id: "DSC03297", x: 2, y: 126.3889, w: 38.8889, range: 1.76 },
  { id: "DSC03298", x: 61.1111, y: 119.1667, w: 38.8889, range: 0.96 },
  { id: "DSC03308", x: 0, y: 169.7222, w: 38.8889, range: 1.6 },
  { id: "DSC03311", x: 58.3333, y: 158.8889, w: 41.6667, range: 1.04 },
  { id: "DSC03334", x: 2, y: 205.8333, w: 38.8889, range: 2 },
  { id: "DSC03343", x: 63.8889, y: 202.2222, w: 36.1111, range: 1.6 },
  { id: "DSC03345", x: 0, y: 245.5556, w: 41.6667, range: 1.04 },
  { id: "DSC03352", x: 60, y: 238.3333, w: 38.8889, range: 2 },
  { id: "DSC03355", x: 2, y: 278.0556, w: 38.8889, range: 1.92 },
  { id: "DSC03368", x: 61.1111, y: 285.2778, w: 38.8889, range: 2.24 },
  { id: "DSC03369", x: 0, y: 321.3889, w: 41.6667, range: 1.68 },
  { id: "DSC03392", x: 58.3333, y: 325, w: 41.6667, range: 1.84 },
];
