"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { renderModelSnapshot, uploadPreview } from "@/components/model-snapshot";
import { useFetchSubmissionFile } from "@/components/admin/download";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { swatchFor } from "@/lib/colours";

export default function PreviewBackfill() {
  const missing = useQuery(api.submissions.missingPreviews);
  const fetchSubmissionFile = useFetchSubmissionFile();
  const generatePreviewUploadUrl = useMutation(api.submissions.generatePreviewUploadUrl);
  const setPreview = useMutation(api.submissions.setPreview);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    succeeded: number;
    failed: number;
    current: string | null;
  } | null>(null);
  const submissions = missing ?? [];

  async function generateMissing() {
    if (running || submissions.length === 0) return;
    const batch = submissions;
    let succeeded = 0;
    let failed = 0;
    setRunning(true);
    setProgress({
      processed: 0,
      total: batch.length,
      succeeded: 0,
      failed: 0,
      current: batch[0].printCode,
    });

    for (const [index, submission] of batch.entries()) {
      setProgress({
        processed: index,
        total: batch.length,
        succeeded,
        failed,
        current: submission.printCode,
      });
      try {
        const { blob: model } = await fetchSubmissionFile(submission._id);
        const image = await renderModelSnapshot(
          model,
          submission.kind,
          swatchFor(submission.colour)
        );
        const previewStorageId = await uploadPreview(
          () => generatePreviewUploadUrl({}),
          image
        );
        const result = await setPreview({ id: submission._id, previewStorageId });
        if (!result.ok) throw new Error(result.error);
        succeeded += 1;
      } catch {
        failed += 1;
      }
      setProgress({
        processed: index + 1,
        total: batch.length,
        succeeded,
        failed,
        current: batch[index + 1]?.printCode ?? null,
      });
    }

    setRunning(false);
    if (failed) toast.error(`Generated ${succeeded} previews; ${failed} failed.`);
    else toast.success(`Generated ${succeeded} previews.`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previews</CardTitle>
        <CardDescription>
          Snapshot images let voters browse without downloading every model.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p>{missing === undefined ? "Loading previews…" : `${submissions.length} submissions without a preview`}</p>
        <Button onClick={() => void generateMissing()} disabled={!submissions.length || running}>
          {running ? "Generating previews…" : "Generate missing previews"}
        </Button>
        {progress ? (
          <>
            {running ? (
              <p role="status">
                Rendering {Math.min(progress.processed + 1, progress.total)} of {progress.total}
                {progress.current ? ` (${progress.current})` : ""}…
              </p>
            ) : null}
            <Progress
              value={progress.total ? (progress.processed / progress.total) * 100 : 0}
              aria-label="Preview generation progress"
            />
            <p>
              {progress.succeeded} done · {progress.failed} failed
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
