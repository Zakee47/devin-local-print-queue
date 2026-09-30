"use client";

import { useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import BrandMark from "@/components/BrandMark";
import { CHALLENGE, EVENT_NAME } from "@/lib/event";

function subscribeNoop() {
  return () => {};
}

export default function TvFooter({ message }: { message: string }) {
  const origin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => ""
  );
  return (
    <footer className="flex h-full items-center gap-8 border-t border-border px-12">
      <BrandMark className="size-12" />
      <div className="min-w-0">
        <p className="font-mono text-lg tracking-[0.18em] text-muted-foreground uppercase">{EVENT_NAME}</p>
        <p className="mt-1 font-heading text-4xl font-semibold tracking-[-0.02em]">{CHALLENGE}. We&apos;ll print it.</p>
      </div>
      <div className="ml-auto flex items-center gap-7">
        <div className="text-right">
          <p className="text-2xl text-muted-foreground">{message}</p>
          <p className="mt-1 font-mono text-3xl font-medium">{origin.replace(/^https?:\/\//, "")}</p>
        </div>
        <div className="rounded-lg bg-white p-2.5">
          {origin ? <QRCodeSVG value={origin} size={108} marginSize={0} /> : <div className="size-[108px]" />}
        </div>
      </div>
    </footer>
  );
}
