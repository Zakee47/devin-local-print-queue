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

// One lane = one grid column of the closing track. Photos in a lane are stacked
// in normal flow, so they never overlap. The lane moves as one unit by ±range px.
export type Lane = {
  pad: number;
  gap: number;
  range: number;
  photos: { id: string; scale: number; align: "start" | "center" | "end" }[];
};

export const LANES_DESKTOP: Lane[] = [
  {
    pad: 3,
    gap: 20,
    range: 145,
    photos: [
      { id: "DSC03244", scale: 88, align: "start" },
      { id: "DSC03253", scale: 100, align: "center" },
      { id: "DSC03263", scale: 82, align: "end" },
      { id: "DSC03267", scale: 94, align: "start" },
      { id: "DSC03269", scale: 86, align: "center" },
    ],
  },
  {
    pad: 13,
    gap: 24,
    range: 115,
    photos: [
      { id: "DSC03277", scale: 78, align: "end" },
      { id: "DSC03297", scale: 92, align: "start" },
      { id: "DSC03298", scale: 82, align: "center" },
      { id: "DSC03308", scale: 96, align: "end" },
      { id: "DSC03311", scale: 80, align: "start" },
    ],
  },
  {
    pad: 25,
    gap: 27,
    range: 70,
    photos: [
      { id: "DSC03334", scale: 64, align: "center" },
      { id: "DSC03343", scale: 72, align: "end" },
      { id: "DSC03345", scale: 58, align: "start" },
      { id: "DSC03352", scale: 68, align: "center" },
      { id: "DSC03355", scale: 62, align: "end" },
    ],
  },
  {
    pad: 34,
    gap: 29,
    range: 50,
    photos: [
      { id: "DSC03368", scale: 56, align: "start" },
      { id: "DSC03369", scale: 64, align: "center" },
      { id: "DSC03392", scale: 58, align: "end" },
      { id: "DSC03402", scale: 62, align: "start" },
      { id: "DSC03409", scale: 54, align: "center" },
    ],
  },
  {
    pad: 30,
    gap: 28,
    range: 60,
    photos: [
      { id: "DSC03412", scale: 60, align: "end" },
      { id: "DSC03432", scale: 68, align: "center" },
      { id: "DSC03446", scale: 56, align: "start" },
      { id: "DSC03465", scale: 64, align: "end" },
      { id: "DSC03476", scale: 58, align: "center" },
    ],
  },
  {
    pad: 16,
    gap: 23,
    range: 120,
    photos: [
      { id: "DSC03487", scale: 84, align: "start" },
      { id: "DSC03488", scale: 76, align: "end" },
      { id: "DSC03527", scale: 96, align: "center" },
      { id: "DSC03572", scale: 82, align: "start" },
      { id: "DSC03651", scale: 90, align: "end" },
    ],
  },
  {
    pad: 6,
    gap: 19,
    range: 155,
    photos: [
      { id: "DSC03691", scale: 92, align: "center" },
      { id: "DSC03696", scale: 84, align: "start" },
      { id: "DSC03766", scale: 100, align: "end" },
      { id: "DSC03771", scale: 78, align: "center" },
      { id: "DSC03811", scale: 94, align: "start" },
    ],
  },
];

export const LANES_MOBILE: Lane[] = [
  {
    pad: 4,
    gap: 23,
    range: 115,
    photos: [
      { id: "DSC03244", scale: 94, align: "start" },
      { id: "DSC03253", scale: 100, align: "center" },
      { id: "DSC03263", scale: 84, align: "end" },
      { id: "DSC03267", scale: 96, align: "start" },
      { id: "DSC03269", scale: 88, align: "center" },
      { id: "DSC03277", scale: 100, align: "end" },
    ],
  },
  {
    pad: 30,
    gap: 29,
    range: 45,
    photos: [
      { id: "DSC03297", scale: 58, align: "center" },
      { id: "DSC03298", scale: 64, align: "end" },
      { id: "DSC03308", scale: 52, align: "start" },
      { id: "DSC03311", scale: 62, align: "center" },
      { id: "DSC03334", scale: 56, align: "end" },
      { id: "DSC03343", scale: 60, align: "start" },
    ],
  },
  {
    pad: 15,
    gap: 24,
    range: 110,
    photos: [
      { id: "DSC03345", scale: 92, align: "end" },
      { id: "DSC03352", scale: 82, align: "center" },
      { id: "DSC03355", scale: 100, align: "start" },
      { id: "DSC03368", scale: 86, align: "end" },
      { id: "DSC03369", scale: 96, align: "center" },
      { id: "DSC03392", scale: 88, align: "start" },
    ],
  },
];
