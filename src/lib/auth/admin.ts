import { headers } from "next/headers";
import { auth, pool } from "@/lib/auth/server";
import {
  adminSetUserArticleWriteAccess,
  getUserArticleWriteAccessMap,
  hasRole,
} from "@/lib/auth/article-permissions";

type AdminListUsersResponse = {
  users?: unknown[];
  total?: number;
};

type RawAdminUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: string | Date | null;
  emailVerified?: boolean | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type SessionStatRow = {
  user_id: string;
  last_seen_at: Date | null;
  active_sessions: string;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  banExpiresAt: string | null;
  emailVerified: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastActiveAt: string | null;
  activeSessions: number;
  canManageArticles: boolean;
};

function toDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value: string | Date | null | undefined) {
  return toDate(value)?.toISOString() ?? null;
}

function getLastActivityAt(userUpdatedAt: string | Date | null | undefined, sessionLastSeenAt: Date | null) {
  const userUpdated = toDate(userUpdatedAt);

  if (userUpdated && sessionLastSeenAt) {
    return userUpdated > sessionLastSeenAt
      ? userUpdated.toISOString()
      : sessionLastSeenAt.toISOString();
  }

  if (userUpdated) {
    return userUpdated.toISOString();
  }

  if (sessionLastSeenAt) {
    return sessionLastSeenAt.toISOString();
  }

  return null;
}

async function getAdminHeaders() {
  return await headers();
}

export async function listAdminUsers(limit = 500) {
  const response = (await auth.api.listUsers({
    query: {
      limit,
      offset: 0,
      sortBy: "createdAt",
      sortDirection: "desc",
    },
    headers: await getAdminHeaders(),
  })) as AdminListUsersResponse;

  const rawUsers = (response.users ?? []) as RawAdminUser[];
  const userIds = rawUsers.map((user) => user.id).filter(Boolean);
  const sessionStats = new Map<string, { lastSeenAt: Date | null; activeSessions: number }>();
  const articleAccessMap = await getUserArticleWriteAccessMap(userIds);

  if (userIds.length > 0) {
    const result = await pool.query<SessionStatRow>(
      `
        select
          s."userId" as user_id,
          max(s."updatedAt") as last_seen_at,
          count(*) filter (where s."expiresAt" > now())::int as active_sessions
        from "session" s
        where s."userId" = any($1::text[])
        group by s."userId"
      `,
      [userIds]
    );

    for (const row of result.rows) {
      sessionStats.set(row.user_id, {
        lastSeenAt: row.last_seen_at,
        activeSessions: Number(row.active_sessions ?? 0),
      });
    }
  }

  const users = rawUsers.map<AdminUser>((user) => {
    const stats = sessionStats.get(user.id);
    const isAdmin = hasRole(user.role, "admin");

    return {
      id: user.id,
      email: user.email,
      name: user.name?.trim() || user.email,
      image: user.image ?? null,
      role: user.role?.trim() || "user",
      banned: Boolean(user.banned),
      banReason: user.banReason?.trim() || null,
      banExpiresAt: toIso(user.banExpires),
      emailVerified: Boolean(user.emailVerified),
      createdAt: toIso(user.createdAt),
      updatedAt: toIso(user.updatedAt),
      lastActiveAt: getLastActivityAt(user.updatedAt, stats?.lastSeenAt ?? null),
      activeSessions: stats?.activeSessions ?? 0,
      canManageArticles: isAdmin || Boolean(articleAccessMap.get(user.id)),
    };
  });

  return {
    users,
    total: typeof response.total === "number" ? response.total : users.length,
  };
}

export async function adminSetUserRole(userId: string, role: "admin" | "user") {
  await auth.api.setRole({
    body: {
      userId,
      role,
    },
    headers: await getAdminHeaders(),
  });
}

export async function adminSetArticlesAccess(
  userId: string,
  canManageArticles: boolean,
  adminUserId: string
) {
  await adminSetUserArticleWriteAccess(userId, canManageArticles, adminUserId);
}

export async function adminBanUser(userId: string, reason?: string) {
  await auth.api.banUser({
    body: {
      userId,
      banReason: reason?.trim() || "Заблокирован администратором.",
    },
    headers: await getAdminHeaders(),
  });
}

export async function adminUnbanUser(userId: string) {
  await auth.api.unbanUser({
    body: {
      userId,
    },
    headers: await getAdminHeaders(),
  });
}

export async function adminRevokeUserSessions(userId: string) {
  await auth.api.revokeUserSessions({
    body: {
      userId,
    },
    headers: await getAdminHeaders(),
  });
}

export async function adminRemoveUser(userId: string) {
  await auth.api.removeUser({
    body: {
      userId,
    },
    headers: await getAdminHeaders(),
  });
}
