import type { SVGProps } from "react";

export default function LumaMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} className={className} viewBox="0 0 133 134" aria-hidden="true">
      <path
        fill="currentColor"
        d="M133 67C96.282 67 66.5 36.994 66.5 0c0 36.994-29.782 67-66.5 67 36.718 0 66.5 30.006 66.5 67 0-36.994 29.782-67 66.5-67"
      />
    </svg>
  );
}
