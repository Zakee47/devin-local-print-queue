"use client";

import { QRCodeSVG } from "qrcode.react";
import { TRY_DEVIN_URL, displayUrl, useSiteUrl } from "./links";

const QR_SIZE = 216;

function QrCard({ label, hint, url }: { label: string; hint: string; url: string }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card px-6 py-7 text-center">
      <div>
        <p className="font-heading text-3xl font-semibold tracking-[-0.02em]">{label}</p>
        <p className="mt-1 text-xl text-muted-foreground">{hint}</p>
      </div>
      <div className="rounded-xl bg-white p-3">
        {url ? (
          <QRCodeSVG value={url} size={QR_SIZE} marginSize={0} />
        ) : (
          <div style={{ width: QR_SIZE, height: QR_SIZE }} />
        )}
      </div>
      <p className="w-full truncate font-mono text-xl font-medium">{displayUrl(url)}</p>
    </div>
  );
}

// Always-visible right-hand rail with the two scan targets.
export default function QrRail() {
  const siteUrl = useSiteUrl();
  return (
    <aside className="flex h-full flex-col justify-center gap-6 border-l border-border bg-background px-6 py-8">
      <QrCard label="Enter, track & vote" hint="Submit your keychain" url={siteUrl} />
      <QrCard label="Try Devin" hint="The AI software engineer" url={TRY_DEVIN_URL} />
    </aside>
  );
}
