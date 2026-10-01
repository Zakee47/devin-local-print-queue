"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

export function convexSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  return url.replace(/\.convex\.cloud$/, ".convex.site").replace(/:3210$/, ":3211");
}

function fileNameFrom(res: Response, fallback: string) {
  const match = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

export function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

// Fetches /download with the viewer's Convex token and returns the blob plus
// the server-provided file name.
export function useFetchSubmissionFile() {
  const { getToken } = useAuth();
  return useCallback(
    async (id: string, fallbackName: string) => {
      const token = await getToken({ template: "convex" });
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`${convexSiteUrl()}/download?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      return { blob, fileName: fileNameFrom(res, fallbackName) };
    },
    [getToken]
  );
}

// Saves the blob under the server-provided name (a same-origin blob URL
// honours `download`).
export function useDownloadSubmission() {
  const fetchFile = useFetchSubmissionFile();
  return useCallback(
    async (id: string, fallbackName: string) => {
      const { blob, fileName } = await fetchFile(id, fallbackName);
      saveBlob(blob, fileName);
    },
    [fetchFile]
  );
}
