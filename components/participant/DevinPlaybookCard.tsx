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
  DEVIN_PLAYBOOK_CREATE_URL,
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

function downloadPlaybook() {
  const anchor = document.createElement("a");
  anchor.href = PLAYBOOK_PATH;
  anchor.download = PLAYBOOK_DOWNLOAD_NAME;
  anchor.click();
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

    if (!copied) {
      downloadPlaybook();
      toast.error(
        "Couldn't copy — downloaded the playbook instead; open it and paste its contents into Devin"
      );
    }

    window.open(DEVIN_PLAYBOOK_CREATE_URL, "_blank", "noopener");
    if (copied) {
      toast.success("Playbook copied — paste it into the playbook body in Devin and save");
    }
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
          <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>Paste (Ctrl/Cmd+V) into the playbook body.</li>
            <li>Name it &quot;Keychain 3D print&quot;.</li>
            <li>Save, then start a session with it and describe your keychain idea.</li>
          </ol>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Paste into the playbook body, name it &quot;Keychain 3D print&quot;, save, then start a session with
            it and describe your keychain idea.
          </p>
        )}
      </CardContent>
      {children ? <CardFooter className="flex-wrap justify-end gap-2">{children}</CardFooter> : null}
    </Card>
  );
}
