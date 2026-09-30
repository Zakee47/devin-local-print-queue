import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandWordmark() {
  return (
    <span className="inline-flex h-6 w-[70px] shrink-0 sm:h-7 sm:w-[82px]" aria-hidden="true">
      <Image
        src="/devin-lockup-black.png"
        alt=""
        width={2984}
        height={1024}
        sizes="(max-width: 639px) 70px, 82px"
        fetchPriority="high"
        className="h-full w-full object-contain dark:hidden"
      />
      <Image
        src="/devin-lockup-white.png"
        alt=""
        width={2984}
        height={1024}
        sizes="(max-width: 639px) 70px, 82px"
        fetchPriority="high"
        className="h-full w-full object-contain hidden dark:block"
      />
    </span>
  );
}

// Devin mark; black/white variants are swapped via CSS for the theme.
export default function BrandMark({ className }: { className?: string }) {
  return (
      <>
        <Image
          src="/devin-black.png"
          alt=""
          aria-hidden="true"
          width={40}
          height={40}
          className={cn("scale-125 dark:hidden", className)}
        />
        <Image
          src="/devin-white.png"
          alt=""
          aria-hidden="true"
          width={40}
          height={40}
          className={cn("scale-125 hidden dark:block", className)}
        />
      </>
  );
}
