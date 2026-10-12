"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Camera, Check, CircleAlert, LoaderCircle, ScanLine, VideoOff } from "lucide-react";
import jsQR from "jsqr";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/errors";

type ScanStatus =
  | "pending"
  | "processing"
  | "checked_in"
  | "already_checked_in"
  | "invalid"
  | "wrong_event"
  | "not_found"
  | "error";

const STATUS_STYLE: Record<ScanStatus, string> = {
  checked_in: "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
  already_checked_in: "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  wrong_event: "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  invalid: "border-red-500/40 bg-red-500/10 text-red-950 dark:text-red-100",
  not_found: "border-red-500/40 bg-red-500/10 text-red-950 dark:text-red-100",
  error: "border-red-500/40 bg-red-500/10 text-red-950 dark:text-red-100",
  pending: "border-border bg-card text-foreground",
  processing: "border-border bg-card text-foreground",
};

const STATUS_LABEL: Record<ScanStatus, string> = {
  checked_in: "Checked in",
  already_checked_in: "Already checked in",
  wrong_event: "Wrong event",
  invalid: "Invalid QR",
  not_found: "Not found on Luma",
  error: "Check-in error",
  pending: "Checking in on Luma…",
  processing: "Checking in on Luma…",
};

type CameraDevice = { deviceId: string; label: string };

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

function displayName(scan: { guestName?: string; guestEmail?: string }) {
  return scan.guestName || scan.guestEmail || "Guest";
}

export default function CheckinScanner() {
  const data = useQuery(api.checkin.recent);
  const submitScan = useMutation(api.checkin.submitScan);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recentRawRef = useRef(new Map<string, number>());
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [usbValue, setUsbValue] = useState("");
  const [latestId, setLatestId] = useState<Id<"checkinScans"> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitRaw = useCallback(
    async (value: string) => {
      const raw = value.trim();
      if (!raw) return;
      const now = Date.now();
      const lastScanned = recentRawRef.current.get(raw);
      if (lastScanned !== undefined && now - lastScanned < 30_000) return;
      recentRawRef.current.set(raw, now);
      for (const [previous, timestamp] of recentRawRef.current) {
        if (now - timestamp >= 30_000) recentRawRef.current.delete(previous);
      }
      setSubmitting(true);
      try {
        const id = await submitScan({ raw });
        setLatestId(id);
      } catch (error) {
        setCameraError(errorMessage(error, "Couldn't submit this scan"));
      } finally {
        setSubmitting(false);
      }
    },
    [submitScan]
  );

  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    if (!navigator.mediaDevices?.getUserMedia) {
      Promise.resolve().then(() => {
        if (active) setCameraError("Camera access is unavailable in this browser.");
      });
      return () => {
        active = false;
      };
    }

    const video = cameraId
      ? { deviceId: { exact: cameraId } }
      : { facingMode: { ideal: "environment" } };
    navigator.mediaDevices
      .getUserMedia({ video, audio: false })
      .then(async (cameraStream) => {
        if (!active) {
          cameraStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = cameraStream;
        if (videoRef.current) {
          videoRef.current.srcObject = cameraStream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraError("");
        setCameraActive(true);
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (active) {
          const available = devices
            .filter((device) => device.kind === "videoinput")
            .map((device, index) => ({
              deviceId: device.deviceId,
              label: device.label || `Camera ${index + 1}`,
            }));
          setCameras(available);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCameraActive(false);
        const name = error instanceof DOMException ? error.name : "";
        setCameraError(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "Camera permission was denied. Allow camera access in your browser settings, or paste a ticket QR below."
            : name === "NotFoundError"
              ? "No camera was found. Paste a ticket QR below or connect a camera."
              : "Couldn't start the camera. Check its permissions or paste a ticket QR below."
        );
      });

    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraId]);

  useEffect(() => {
    if (!cameraActive) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const BarcodeDetector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
      .BarcodeDetector;
    const detector = BarcodeDetector ? new BarcodeDetector({ formats: ["qr_code"] }) : null;
    let detecting = false;
    const timer = window.setInterval(async () => {
      if (detecting || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      detecting = true;
      try {
        let raw: string | undefined;
        if (detector) {
          raw = (await detector.detect(video))[0]?.rawValue;
        } else {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          raw = jsQR(image.data, image.width, image.height)?.data;
        }
        if (raw) void submitRaw(raw);
      } catch {
        // A transient frame decode error should not interrupt camera scanning.
      } finally {
        detecting = false;
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, [cameraActive, submitRaw]);

  if (data === undefined) return <Skeleton className="h-[30rem] rounded-xl" />;

  const latest = data.scans.find((scan) => scan._id === latestId) ?? data.scans[0];
  const online = data.workerOnline;

  return (
    <div className="flex flex-col gap-6">
      {!online ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100">
          <CircleAlert />
          <AlertTitle>Luma worker offline — scans are queued</AlertTitle>
          <AlertDescription>New scans will be checked in when the worker reconnects.</AlertDescription>
        </Alert>
      ) : data.lumaSession === "expired" ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100">
          <CircleAlert />
          <AlertTitle>Luma session expired — sign in again on the VM</AlertTitle>
          <AlertDescription>Scans remain queued until the worker is signed in.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <section className="flex flex-col gap-4">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-border">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950 px-6 text-center text-white">
                <VideoOff className="size-9 text-white/60" />
                <p className="w-full max-w-sm text-sm text-white/75">
                  {cameraError || "Allow camera access to scan a guest ticket."}
                </p>
              </div>
            )}
            {cameraActive && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="size-48 rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.2)] sm:size-60" />
              </div>
            )}
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">
              <Camera className="size-3.5" />
              {cameraActive ? "Camera ready" : "No camera"}
            </div>
          </div>
          {cameraError && cameraActive && (
            <p role="status" className="text-sm text-red-600 dark:text-red-400">{cameraError}</p>
          )}
          {cameras.length > 1 && (
            <label className="flex flex-col gap-2 text-sm">
              Camera
              <select
                value={cameraId}
                onChange={(event) => setCameraId(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <option value="">Default rear camera</option>
                {cameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>
                ))}
              </select>
            </label>
          )}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submitRaw(usbValue);
              setUsbValue("");
            }}
          >
            <Input
              value={usbValue}
              onChange={(event) => setUsbValue(event.target.value)}
              placeholder="Paste or scan with a USB scanner"
              aria-label="Paste or scan ticket QR"
              autoComplete="off"
            />
            <Button type="submit" disabled={!usbValue.trim() || submitting}>
              <ScanLine data-icon="inline-start" />
              Scan
            </Button>
          </form>
        </section>

        <section className="flex flex-col gap-6">
          <div className={`min-h-48 rounded-xl border p-6 ${latest ? STATUS_STYLE[latest.status] : "border-border bg-card"}`}>
            <div className="mb-5 flex items-center gap-2 text-sm font-medium">
              {latest?.status === "checked_in" ? (
                <Check className="size-5" />
              ) : latest && (latest.status === "pending" || latest.status === "processing") ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : latest ? (
                <CircleAlert className="size-5" />
              ) : (
                <ScanLine className="size-5" />
              )}
              {latest ? STATUS_LABEL[latest.status] : "Ready to scan"}
            </div>
            {latest ? (
              <>
                <h2 className="font-heading text-3xl font-semibold tracking-tight">
                  {displayName(latest)}
                </h2>
                {latest.guestEmail && (
                  <p className="mt-1 text-sm opacity-75">{latest.guestEmail}</p>
                )}
                {latest.message && <p className="mt-4 text-sm opacity-80">{latest.message}</p>}
                {latest.inGuestList === false && latest.status === "checked_in" && (
                  <p className="mt-2 text-sm opacity-80">Not in the local guest list; Luma check-in succeeded.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">The latest scan result will appear here.</p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-semibold">Recent scans</h2>
              <span className="font-mono text-xs text-muted-foreground">{data.scans.length} / 20</span>
            </div>
            {data.scans.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No scans yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {data.scans.map((scan) => (
                  <li key={scan._id}>
                    <button
                      type="button"
                      onClick={() => setLatestId(scan._id)}
                      className={`flex w-full items-center justify-between gap-4 rounded-lg px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${latest?._id === scan._id ? "bg-muted/70" : "hover:bg-muted/40"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{displayName(scan)}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {new Date(scan.finishedAt ?? scan._creationTime).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {scan.guestEmail ? ` · ${scan.guestEmail}` : ""}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[scan.status]}`}>
                        {STATUS_LABEL[scan.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
