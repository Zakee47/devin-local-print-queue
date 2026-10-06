import { Heart, Trophy } from "lucide-react";

export default function VoteVsHeartArt() {
  return (
    <div className="tour-art tour-voting grid h-full grid-cols-2 items-center gap-3 px-6 py-5">
      <div className="flex flex-col items-center gap-2">
        <Trophy aria-hidden className="size-6 text-brand" />
        <span className="text-xs font-semibold text-foreground">Vote</span>
        <div className="flex h-8 items-center gap-2">
          <span className="tour-vote-token tour-vote-cast grid size-7 place-items-center rounded-full border border-brand bg-brand text-[9px] font-bold text-brand-foreground">
            1
          </span>
          <span className="tour-vote-token tour-vote-uncast grid size-7 place-items-center rounded-full border border-border bg-card text-[9px] text-muted-foreground">
            2
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">Picks the winner</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Heart aria-hidden className="tour-heart size-6 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Heart</span>
        <span className="flex h-8 items-center gap-1 rounded-full border border-border bg-card px-2.5 font-mono text-[10px] text-muted-foreground">
          <Heart aria-hidden className="size-3 fill-current" />
          12 likes
        </span>
        <span className="text-[10px] text-muted-foreground">Breaks ties</span>
      </div>
    </div>
  );
}
