"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDateTime } from "@/lib/datetime";
import { MAX_BLAST_MESSAGE_LENGTH } from "@/lib/event";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import { SETTINGS_HELP } from "@/lib/settings-help";
import SettingHelp from "@/components/admin/SettingHelp";

export default function BlastComposer() {
  const settings = useQuery(api.settings.get);
  const update = useMutation(api.settings.update);
  const [messageInput, setMessageInput] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!settings) return <Skeleton className="h-48 rounded-xl" />;

  const message = messageInput ?? settings.announcement ?? "";
  const liveStatus = settings.announcement
    ? settings.announcementUpdatedAt === undefined
      ? "Live now"
      : `Live now · sent ${formatDateTime(settings.announcementUpdatedAt)}`
    : "No active blast";

  async function save(announcement: string | null, successMessage: string) {
    setSaving(true);
    try {
      await update({ announcement });
      setMessageInput(announcement ?? "");
      toast.success(successMessage);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <div className="flex items-center gap-1">
            <CardTitle>Blast message</CardTitle>
            <SettingHelp {...SETTINGS_HELP.blast} />
          </div>
          <CardDescription>This message appears at the top of every page.</CardDescription>
        </div>
        <p className="shrink-0 text-xs font-medium text-muted-foreground">{liveStatus}</p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!message.trim()) {
              toast.error("Enter a blast message");
              return;
            }
            void save(message, "Blast sent");
          }}
        >
          <Field>
            <FieldLabel htmlFor="blast-message">Message for everyone</FieldLabel>
            <Textarea
              id="blast-message"
              rows={3}
              maxLength={MAX_BLAST_MESSAGE_LENGTH}
              value={message}
              onChange={(event) => setMessageInput(event.target.value)}
              placeholder="Share an update with everyone"
            />
            <FieldDescription className="text-right">
              {message.length}/{MAX_BLAST_MESSAGE_LENGTH}
            </FieldDescription>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="brand" disabled={saving || !message.trim()}>
              Send blast
            </Button>
            {settings.announcement ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void save(null, "Blast cleared")}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
