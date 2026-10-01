"use client";

import { useState } from "react";
import { Archive, Download } from "lucide-react";
import { strToU8, zipSync } from "fflate";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { downloadCsv, toCsv } from "@/lib/csv";
import { exportCsvName, exportCsvRows, exportZipName } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { saveBlob, useFetchSubmissionFile } from "@/components/admin/download";
import { errorMessage } from "@/lib/errors";

const CONCURRENCY = 4;

export default function ExportButtons() {
  const rows = useQuery(api.queue.exportRows);
  const fetchFile = useFetchSubmissionFile();
  const [zipping, setZipping] = useState<{ done: number; total: number } | null>(null);

  async function exportAll() {
    if (!rows) return;
    const total = rows.length;
    setZipping({ done: 0, total });
    try {
      const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
      const failed: string[] = [];
      let next = 0;
      let done = 0;
      const worker = async () => {
        while (next < total) {
          const row = rows[next++];
          try {
            const { blob, fileName } = await fetchFile(row.id, row.downloadName);
            const zipName = fileName ?? row.downloadName;
            files[zipName] = [
              new Uint8Array(await blob.arrayBuffer()),
              { level: zipName.endsWith(".3mf") ? 0 : 6 },
            ];
          } catch {
            failed.push(row.printCode);
          }
          done += 1;
          setZipping({ done, total });
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
      files["submissions.csv"] = [strToU8(toCsv(exportCsvRows(rows))), { level: 6 }];
      const zipped = zipSync(files);
      saveBlob(new Blob([zipped.buffer as ArrayBuffer]), exportZipName(new Date()));
      if (failed.length > 0) {
        toast.error(`${failed.length} file(s) couldn't be downloaded: ${failed.join(", ")}`);
      } else {
        toast.success(`Exported ${total} files`);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Export failed"));
    } finally {
      setZipping(null);
    }
  }

  const busy = zipping !== null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => void exportAll()} disabled={rows === undefined || busy}>
        <Archive data-icon="inline-start" />
        {busy ? `Zipping ${zipping.done}/${zipping.total}…` : "Export all"}
      </Button>
      <Button
        variant="outline"
        disabled={rows === undefined || busy}
        onClick={() => {
          if (!rows) return;
          downloadCsv(exportCsvName(new Date()), exportCsvRows(rows));
        }}
      >
        <Download data-icon="inline-start" />
        Export CSV
      </Button>
    </div>
  );
}
