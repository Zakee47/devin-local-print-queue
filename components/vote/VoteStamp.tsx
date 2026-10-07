"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// The tutorial renders a static instance that mirrors this component's stamp art.
export default function VoteStamp({
  voted,
  voteNumber,
  maxVotes = 2,
  animate = true,
  className,
}: {
  voted: boolean;
  voteNumber?: number;
  maxVotes?: number;
  animate?: boolean;
  className?: string;
}) {
  const previous = useRef(voted);
  const [landings, setLandings] = useState(0);
  useEffect(() => {
    if (voted && !previous.current) setLandings((n) => n + 1);
    previous.current = voted;
  }, [voted]);
  if (!voted) return null;
  return (
    <span
      key={landings}
      aria-hidden
      className={cn("vote-stamp pointer-events-none", animate && landings > 0 && "stamp-land", className)}
    >
      <span className="vote-stamp-ink">
        <span className="vote-stamp-kicker">Official ballot</span>
        <span className="vote-stamp-word">Voted</span>
        {voteNumber ? (
          <span className="vote-stamp-kicker">
            Vote {voteNumber} of {maxVotes}
          </span>
        ) : null}
      </span>
    </span>
  );
}
