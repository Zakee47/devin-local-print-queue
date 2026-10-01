"use client";

import { useSyncExternalStore } from "react";

export const TRY_DEVIN_URL = "https://www.trydevin.ai/devin-local-london";

function subscribeNoop() {
  return () => {};
}

// Public URL of this site: NEXT_PUBLIC_SITE_URL when configured, otherwise the
// origin the TV is loaded from. Empty during SSR.
export function useSiteUrl() {
  return useSyncExternalStore(
    subscribeNoop,
    () => process.env.NEXT_PUBLIC_SITE_URL || window.location.origin,
    () => ""
  );
}

export const displayUrl = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");
