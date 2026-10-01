"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
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
  devinPlaybookCreateUrl,
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

  return { text, getText };
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
  const { text, getText } = usePlaybookText();
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    getOriginSnapshot,
    getServerOriginSnapshot
  );
  const compact = variant === "compact";

  async function createPlaybook() {
    let copied = false;
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      const fallbackText = await getText();
      if (fallbackText) copied = await copyText(fallbackText);
    }

    window.open(devinPlaybookCreateUrl(window.location.origin), "_blank", "noopener");
    toast.success(
      copied
        ? "Opened in Devin with the playbook filled in — name it and save. Full text also copied to your clipboard."
        : "Opened in Devin with the playbook filled in — name it and save."
    );
  }

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
            type="button"
            variant="brand"
            size={compact ? "default" : "lg"}
            onClick={createPlaybook}
          >
            Create playbook in Devin
            <ExternalLink data-icon="inline-end" />
          </Button>
          <Button
            variant="outline"
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
              <li>Name it &quot;Keychain 3D print&quot;.</li>
              <li>Save.</li>
              <li>Start a session with it and describe your keychain idea.</li>
            </ol>
            <p>
              Want the full text inline instead? Select all in the body and paste (Ctrl/Cmd+V) — it&apos;s on your
              clipboard.
            </p>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Name it &quot;Keychain 3D print&quot;, save, then start a session with it and describe your keychain idea.
            The full text is also on your clipboard.
          </p>
        )}
      </CardContent>
      {children ? <CardFooter className="flex-wrap justify-end gap-2">{children}</CardFooter> : null}
    </Card>
  );
}
