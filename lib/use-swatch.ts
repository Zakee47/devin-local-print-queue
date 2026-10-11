"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { swatchFor } from "@/lib/colours";

export function useSwatch() {
  const settings = useQuery(api.settings.get);
  return (colour?: string | null) => swatchFor(colour, settings?.colourCodes);
}
