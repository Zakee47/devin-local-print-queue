"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { Copy, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copyText } from "@/lib/clipboard";
import {
  devinStartUrl,
  PLAYBOOK_DOWNLOAD_NAME,
  PLAYBOOK_PATH,
} from "@/lib/devin-links";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Use the organisers' playbook in your own Devin account to design a keychain that fits the competition size rules.";

function subscribeToOrigin() {
  return () => {};
}

function getOriginSnapshot() {
  return window.location.origin;
}

function getServerOriginSnapshot(): null {
  return null;
}

function usePlaybookText() {
  const [text, setText] = useState<string | null>(null);
  const requestRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    let active = true;
    const request = fetch(PLAYBOOK_PATH)
      .then((response) => (response.ok ? response.text() : null))
      .catch(() => null);
    requestRef.current = request;
    void request.then((value) => {
      if (active) setText(value);
    });

    return () => {
      active = false;
    };
  }, []);

  async function getText() {
    return text ?? (await requestRef.current);
  }

  return { getText };
}

export default function DevinPlaybookCard({
  variant = "full",
  className,
  children,
}: {
  variant?: "full" | "compact";
  className?: string;
  children?: ReactNode;
}) {
  const { getText } = usePlaybookText();
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    getOriginSnapshot,
    getServerOriginSnapshot
  );
  const compact = variant === "compact";

  async function copyMarkdown() {
    const markdown = await getText();
    if (markdown && (await copyText(markdown))) {
      toast.success("Playbook copied");
    } else {
      toast.error("Couldn't copy the playbook");
    }
  }

  return (
    <Card size={compact ? "sm" : "default"} className={className}>
      <CardHeader>
        {!compact ? <CardTitle>Design with Devin</CardTitle> : null}
        <CardDescription>{DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-3", compact && "gap-2.5")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="brand"
            size={compact ? "default" : "lg"}
            render={
              <a
                href={origin ? devinStartUrl(origin) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!origin}
                tabIndex={origin ? undefined : -1}
              />
            }
          >
            <Image
              src="/devin-white.png"
              alt=""
              aria-hidden
              width={16}
              height={16}
              data-icon="inline-start"
              className="size-4"
            />
            Start in Devin
            <ExternalLink data-icon="inline-end" />
          </Button>
          <Button type="button" variant="ghost" onClick={copyMarkdown}>
            <Copy data-icon="inline-start" />
            Copy .md
          </Button>
          <Button
            variant="ghost"
            render={
              <a href={PLAYBOOK_PATH} download={PLAYBOOK_DOWNLOAD_NAME} />
            }
          >
            <Download data-icon="inline-start" />
            Download .md
          </Button>
        </div>
        {!compact ? (
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Click Start in Devin — it opens a new Devin session that loads the competition playbook.</li>
              <li>Type your keychain idea after “My idea:” and send it.</li>
              <li>Iterate with Devin until you have your STL and 3MF, then upload them here.</li>
            </ol>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Opens a new Devin session with the competition playbook — type your keychain idea after “My idea:” and
            send it.
          </p>
        )}
      </CardContent>
      {children ? <CardFooter className="flex-wrap justify-end gap-2">{children}</CardFooter> : null}
    </Card>
  );
}
