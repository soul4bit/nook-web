import { headers } from "next/headers";
import { auth } from "./server";
import { isAdminRole } from "./article-permissions";

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export function isAdminSession(
  session: Awaited<ReturnType<typeof getCurrentSession>> | null
) {
  return isAdminRole((session?.user as { role?: unknown } | undefined)?.role);
}
