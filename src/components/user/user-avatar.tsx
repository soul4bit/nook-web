"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  image?: string | null;
  name?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

function getInitials(name?: string | null) {
  const value = name?.trim();

  if (!value) {
    return "N";
  }

  const parts = value.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "N";
}

export function UserAvatar({
  image,
  name,
  className,
  imageClassName,
  fallbackClassName,
}: UserAvatarProps) {
  const initials = getInitials(name);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const showImage = Boolean(image) && failedImage !== image;

  return (
    <div
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#31413a] bg-[#111513]",
        className
      )}
    >
      {showImage ? (
        <>
          {/* Для локального превью и файлов из public/uploads обычный img надежнее. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image ?? undefined}
            alt={name ? `Аватар ${name}` : "Аватар"}
            className={cn("h-full w-full object-cover", imageClassName)}
            onError={() => setFailedImage(image ?? null)}
          />
        </>
      ) : (
        <span
          className={cn(
            "text-sm font-semibold uppercase tracking-[0.16em] text-[#53e6a6]",
            fallbackClassName
          )}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
