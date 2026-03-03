import Image from "next/image";
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
  subtitle = "документация, но живая",
}: KnowledgeLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex h-12 w-16 items-center justify-center rounded-xl border-2 border-border bg-card shadow-[3px_3px_0_var(--border)]",
          markClassName
        )}
      >
        <Image
          src="/branding/logo-mark.svg"
          alt="Логотип Nook"
          width={48}
          height={36}
          className="h-8 w-12 object-contain"
          priority
        />
      </div>
      <div>
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground",
            titleClassName
          )}
        >
          Nook Wiki
        </p>
        <p className={cn("text-sm text-muted-foreground", subtitleClassName)}>{subtitle}</p>
      </div>
    </div>
  );
}
