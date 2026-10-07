import { cn } from "@/lib/utils";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function HeroImage({ variant }: { variant: string }) {
  return (
    <picture className="relative block size-full">
      <source media={REDUCED_MOTION} srcSet={`/hero/${variant}-still.webp`} />
      <img
        src={`/hero/${variant}.webp`}
        alt=""
        width={512}
        height={512}
        decoding="async"
        className="absolute inset-0 size-full object-contain"
      />
    </picture>
  );
}

export default function HeroKeychains({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none relative select-none", className)}>
      <div className="absolute top-0 left-[40%] aspect-square h-[82%] lg:top-[2%] lg:left-[10%] lg:h-auto lg:w-[52%] xl:left-0">
        <HeroImage variant="cognition" />
      </div>
      <div className="absolute bottom-0 left-0 aspect-square h-full lg:-left-[24%] lg:h-auto lg:w-[76%] xl:-left-[34%]">
        <HeroImage variant="mascot" />
      </div>
    </div>
  );
}
