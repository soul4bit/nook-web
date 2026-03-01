export function normalizeAvatarUrl(image?: string | null) {
  if (!image) {
    return null;
  }

  const [pathname, query = ""] = image.split("?");

  if (pathname.startsWith("/uploads/avatars/")) {
    const fileName = pathname.slice("/uploads/avatars/".length);
    return `/api/account/avatar/${fileName}${query ? `?${query}` : ""}`;
  }

  return image;
}

export function withAvatarVersion(image?: string | null) {
  const normalized = normalizeAvatarUrl(image);

  if (!normalized) {
    return null;
  }

  const separator = normalized.includes("?") ? "&" : "?";
  return `${normalized}${separator}v=${Date.now()}`;
}
