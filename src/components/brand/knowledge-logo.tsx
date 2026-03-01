import { cn } from "@/lib/utils";

type KnowledgeLogoProps = {
  className?: string;
  markClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  subtitle?: string;
};

export function KnowledgeLogo({
  className,
  markClassName,
  titleClassName,
  subtitleClassName,
  subtitle = "Контур Знаний",
}: KnowledgeLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex h-12 w-16 items-center justify-center rounded-[14px] border border-[#93adbf] bg-[#1f2c38] text-[#4fb7ea]",
          markClassName
        )}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 96 64"
          className="h-8 w-12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="2" y="27" width="8" height="10" rx="2" fill="currentColor" />
          <path
            d="M18 10h20v14h-9c-8 0-14 6-14 14v16H2V26c0-9 7-16 16-16z"
            fill="currentColor"
          />
          <path
            d="M39 54h-13c0-11 6-16 15-23 10-8 13-12 13-21h14c0 12-4 19-14 27-8 6-15 10-15 17z"
            fill="currentColor"
          />
          <path
            d="M56 54V38c0-8 6-14 14-14h9V10h13v28c0 9-7 16-16 16H56z"
            fill="currentColor"
          />
          <rect x="86" y="27" width="8" height="10" rx="2" fill="currentColor" />
        </svg>
      </div>
      <div>
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.24em] text-[#4d697c]",
            titleClassName
          )}
        >
          Контур Знаний
        </p>
        <p className={cn("text-sm text-slate-700", subtitleClassName)}>{subtitle}</p>
      </div>
    </div>
  );
}
