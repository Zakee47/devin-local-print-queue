import { AlertCircle, ArrowDownToLine, Check, File, Filter, Info, MessageSquareText, Pause, Printer, Settings, Trophy, Tv, Upload } from "lucide-react";
import type { TutorialArt as TutorialArtKey } from "@/lib/tutorials";
import VoteVsHeartArt from "./VoteVsHeartArt";

function UploadArt() {
  return (
    <div className="tour-art tour-upload flex h-full items-center justify-center p-6">
      <div className="w-full max-w-[19rem] rounded-xl border border-dashed border-border-strong bg-card p-4">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Upload aria-hidden className="size-4" />
          <span className="text-xs">Drop your design here</span>
        </div>
        <div className="mt-4 flex min-h-11 items-center justify-center">
          <div className="tour-upload-file flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
            <File aria-hidden className="size-4 text-muted-foreground" />
            <span className="font-mono text-xs text-foreground">KC-007.stl</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Your uploads</span>
          <span className="font-mono text-foreground">1 / 2 uploads</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="tour-upload-progress h-full w-1/2 origin-left rounded-full bg-brand" />
        </div>
      </div>
    </div>
  );
}

function RolesArt() {
  const options = [
    { label: "Vote", Icon: Trophy, className: "tour-role-vote" },
    { label: "Print", Icon: Printer, className: "tour-role-print" },
    { label: "Both", Icon: Trophy, className: "tour-role-both" },
  ];
  return (
    <div className="tour-art tour-roles flex h-full items-center justify-center p-5">
      <div className="grid w-full max-w-[21rem] grid-cols-3 gap-2">
        {options.map(({ label, Icon, className }) => (
          <div
            key={label}
            className={`tour-role-tile ${className} flex min-w-0 flex-col items-center gap-2 rounded-xl border border-border bg-card px-2 py-4 text-muted-foreground`}
          >
            <Icon aria-hidden className="size-5" />
            <span className="text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColourArt() {
  const options = [
    { label: "Any colour", waiting: "2 waiting", colour: null },
    { label: "Sky Blue", waiting: "2 waiting", colour: "#76b8d8" },
    { label: "Gold", waiting: "9 waiting", colour: "#d7a72e" },
  ];
  return (
    <div className="tour-art tour-colour flex h-full items-center justify-center p-5">
      <div className="grid w-full max-w-[22rem] grid-cols-3 gap-2">
        {options.map(({ label, waiting, colour }, index) => (
          <div
            key={label}
            className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border p-3 text-center ${
              index === 1 ? "border-brand bg-brand/10 ring-2 ring-brand/30" : "border-border bg-card"
            }`}
          >
            <span
              aria-hidden
              className="size-6 rounded-full ring-1 ring-foreground/15"
              style={{ backgroundColor: colour ?? "transparent" }}
            />
            <span className="text-[10px] font-medium text-foreground">{label}</span>
            <span className="font-mono text-[9px] text-muted-foreground">{waiting}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyArt() {
  const steps = ["Needs approval", "Queued", "Printing", "Done"];
  return (
    <div className="tour-art tour-journey flex h-full items-center justify-center p-6">
      <ol className="grid w-full max-w-[22rem] grid-cols-4 gap-2">
        {steps.map((step, index) => (
          <li key={step} className="flex min-w-0 flex-col gap-2">
            <span className={`tour-journey-fill tour-journey-${index + 1} h-1.5 rounded-full bg-brand`} />
            <span className="flex min-h-8 items-start gap-1 text-[10px] leading-tight text-foreground sm:text-[11px]">
              {index === 3 ? <Check aria-hidden className="size-3 shrink-0" /> : null}
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ChangesArt() {
  return (
    <div className="tour-art tour-changes flex h-full items-center justify-center p-6">
      <div className="w-full max-w-[20rem] rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-semibold">KC-007</span>
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">Vote</span>
        </div>
        <div className="relative mt-4 h-9 overflow-hidden">
          <span className="tour-change-old absolute inset-y-0 left-0 flex items-center gap-2 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground">
            <File aria-hidden className="size-3.5" />
            rocket-v1.stl
          </span>
          <span className="tour-change-new absolute inset-y-0 left-0 flex items-center gap-2 rounded-md border border-border bg-background px-2 text-[11px] text-foreground">
            <File aria-hidden className="size-3.5" />
            rocket-v2.stl
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">Votes reset</span>
          <span className="relative h-4 w-16 font-mono font-medium whitespace-nowrap text-foreground">
            <span className="tour-votes-before absolute inset-0 text-right">3 votes</span>
            <span className="tour-votes-after absolute inset-0 text-right">0 votes</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function HelpArt() {
  return (
    <div className="tour-art tour-help flex h-full items-center justify-center p-6">
      <div className="flex w-full max-w-[21rem] items-center justify-between rounded-xl border border-border bg-card px-3 py-3 shadow-sm">
        <div className="size-8 rounded-md bg-foreground" aria-hidden />
        <div className="flex items-center gap-3 text-muted-foreground">
          <Tv aria-hidden className="size-4" />
          <span className="size-4 rounded-full border border-border bg-muted" aria-hidden />
          <span className="tour-help-button relative grid size-8 place-items-center rounded-full border border-border bg-background text-foreground">
            <span className="tour-help-ring absolute inset-0 rounded-full border-2 border-brand/30" />
            <Info aria-hidden className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

function QueueArt() {
  const tabs = ["Needs review", "Queued", "Printing", "Done"];
  return (
    <div className="tour-art tour-queue flex h-full items-center justify-center p-6">
      <div className="w-full max-w-[22rem]">
        <div className="grid grid-cols-4 gap-1 border-b border-border">
          {tabs.map((tab, index) => (
            <span
              key={tab}
              className={`tour-queue-tab tour-queue-tab-${index + 1} border-b-2 border-transparent pb-2 text-center text-[9px] leading-tight text-muted-foreground sm:text-[10px]`}
            >
              {tab}
            </span>
          ))}
        </div>
        <div className="relative mt-4 h-16 overflow-hidden rounded-lg bg-muted/60 p-2">
          <div className="tour-queue-card absolute top-2 left-2 flex h-12 w-[calc(25%-1rem)] min-w-14 items-center rounded-md border border-border bg-card px-1 shadow-sm">
            <span className="w-full text-center font-mono text-[10px]">KC-007</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FiltersArt() {
  return (
    <div className="tour-art tour-filters flex h-full items-center justify-center p-6">
      <div className="w-full max-w-[22rem] rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Filter aria-hidden className="size-3.5" />
          All · Gold · Muon 1
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-border bg-background px-3 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 font-medium">
            <Pause aria-hidden className="size-3" />
            Muon 1 · paused
          </span>
          <span>4 queued · 1 printing</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="block h-full w-2/3 rounded-full bg-brand" />
        </div>
      </div>
    </div>
  );
}

function SettingsArt() {
  return (
    <div className="tour-art flex h-full items-center justify-center p-5">
      <div className="w-full max-w-[22rem] rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-medium">
            <Settings aria-hidden className="size-4" />
            Printer settings
          </span>
          <span className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <Pause aria-hidden className="size-3" />
            Paused
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background p-2">
          <span aria-hidden className="size-4 rounded-full bg-[#d93636]" />
          <span className="flex-1 text-[10px]">Red</span>
          <code className="text-[10px] text-muted-foreground">#d93636</code>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[10px] text-muted-foreground">
          <MessageSquareText aria-hidden className="size-3.5" />
          Blast message to everyone
        </div>
      </div>
    </div>
  );
}

function DownloadArt() {
  return (
    <div className="tour-art tour-download flex h-full items-center justify-center p-5">
      <div className="flex w-full max-w-[22rem] flex-col items-center">
        <span className="max-w-full truncate rounded-lg border border-border bg-card px-3 py-2 font-mono text-[10px] text-foreground shadow-sm sm:text-[11px]">
          KC-007_ada-lovelace_red_rocket.3mf
        </span>
        <div className="relative mt-3 grid size-12 place-items-center">
          <ArrowDownToLine aria-hidden className="tour-download-arrow absolute bottom-2 size-5 text-foreground" />
          <div className="absolute bottom-1 h-3 w-8 rounded-b-md border-x-2 border-b-2 border-border" />
        </div>
      </div>
    </div>
  );
}

function ReviewArt() {
  return (
    <div className="tour-art tour-review flex h-full items-center justify-center p-6">
      <div className="w-full max-w-[20rem] rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-medium">KC-007</span>
          <span className="tour-review-approve flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground">
            Approve <Check aria-hidden className="size-3" />
          </span>
        </div>
        <div className="tour-review-comment mt-4 ml-auto max-w-[90%] rounded-xl rounded-br-sm bg-muted px-3 py-2 text-[11px] leading-snug text-foreground">
          Too big — please scale to 60mm
        </div>
      </div>
    </div>
  );
}

function PrintingArt() {
  return (
    <div className="tour-art tour-printing flex h-full items-center justify-center p-5">
      <div className="relative h-36 w-48 rounded-xl border border-border bg-card shadow-sm">
        <div className="absolute top-3 left-4 right-4 h-1 rounded-full bg-muted" />
        <div className="absolute top-4 bottom-4 left-5 right-5 border-x border-border" />
        <div className="tour-printer-nozzle absolute top-5 left-1/2 z-10 h-5 w-5 -translate-x-1/2">
          <span className="mx-auto block h-3 w-2 rounded-t-sm bg-foreground" />
          <span className="mx-auto block h-2 w-1 border-x border-b border-border" />
        </div>
        <div className="absolute bottom-5 left-8 right-8 h-1 rounded-full bg-muted" />
        <div className="absolute bottom-6 left-1/2 flex w-12 -translate-x-1/2 flex-col items-center gap-0.5">
          <span className="tour-print-layer h-1 w-8 rounded-sm bg-foreground" />
          <span className="tour-print-layer h-1 w-10 rounded-sm bg-foreground" />
          <span className="tour-print-layer h-1 w-12 rounded-sm bg-foreground" />
        </div>
        <span className="tour-print-done absolute -right-2 -bottom-2 flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground shadow-sm">
          <Check aria-hidden className="size-3" />
          Done
        </span>
      </div>
    </div>
  );
}

function ChangedArt() {
  return (
    <div className="tour-art tour-changed flex h-full items-center justify-center p-6">
      <div className="w-full max-w-[21rem] rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertCircle aria-hidden className="size-4 text-muted-foreground" />
          Changed by participants
        </div>
        <div className="tour-changed-row mt-4 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <span className="truncate text-xs text-foreground">KC-007 · replaced</span>
          <span className="tour-changed-badge shrink-0 rounded-full bg-muted px-2 py-1 text-[9px] text-foreground">
            Needs approval again
          </span>
        </div>
      </div>
    </div>
  );
}

function TvArt() {
  return (
    <div className="tour-art tour-tv flex h-full items-center justify-center p-6">
      <div className="w-full max-w-[19rem] rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between text-[10px] font-medium">
          <span className="text-foreground">Now printing</span>
          <span className="font-mono text-muted-foreground">KC-007</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <span className="block h-full w-2/3 rounded-full bg-foreground" />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px]">
          <span className="text-muted-foreground">Up next</span>
          <div className="flex gap-1">
            <span className="h-1.5 w-8 rounded-full bg-muted-foreground/60" />
            <span className="h-1.5 w-5 rounded-full bg-muted" />
            <span className="h-1.5 w-3 rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TutorialArt({ art }: { art: TutorialArtKey }) {
  switch (art) {
    case "upload":
      return <UploadArt />;
    case "roles":
      return <RolesArt />;
    case "colour":
      return <ColourArt />;
    case "journey":
      return <JourneyArt />;
    case "voting":
      return <VoteVsHeartArt />;
    case "changes":
      return <ChangesArt />;
    case "help":
      return <HelpArt />;
    case "queue":
      return <QueueArt />;
    case "filters":
      return <FiltersArt />;
    case "download":
      return <DownloadArt />;
    case "review":
      return <ReviewArt />;
    case "printing":
      return <PrintingArt />;
    case "changed":
      return <ChangedArt />;
    case "tv":
      return <TvArt />;
    case "settings":
      return <SettingsArt />;
  }
}
