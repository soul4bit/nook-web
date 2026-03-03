import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-sm text-foreground shadow-[3px_3px_0_var(--border)] transition-all",
        "placeholder:text-muted-foreground focus-visible:-translate-y-px focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
