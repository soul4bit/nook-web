"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);

    try {
      await authClient.signOut();
      router.replace("/auth");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "rounded-2xl border-slate-700/80 bg-[#132231] text-slate-200 hover:bg-[#162431]",
        className
      )}
      onClick={handleSignOut}
      disabled={isPending}
    >
      {isPending ? "Выходим..." : "Выйти"}
    </Button>
  );
}
