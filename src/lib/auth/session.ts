import { headers } from "next/headers";
import { auth } from "./server";

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export function isAdminSession(
  session: Awaited<ReturnType<typeof getCurrentSession>> | null
) {
  return (session?.user as { role?: unknown } | undefined)?.role === "admin";
}
