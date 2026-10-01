import DevinCredit from "@/components/DevinCredit";
import { PAGE_WIDTHS, type PageWidth } from "@/lib/page-width";
import { cn } from "@/lib/utils";

export default function SiteFooter({
  width = "default",
}: {
  width?: PageWidth;
}) {
  return (
    <footer className="border-t border-border">
      <div
        className={cn(
          "mx-auto flex min-h-14 items-center justify-end gap-4 px-4 py-3 sm:px-6",
          PAGE_WIDTHS[width]
        )}
      >
        <DevinCredit />
      </div>
    </footer>
  );
}
