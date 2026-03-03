import { pool } from "@/lib/auth/server";

type UserArticlePermissionRow = {
  user_id: string;
  can_manage_articles: boolean;
};

function isUndefinedTableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "42P01"
  );
}

function normalizeRoleList(roleValue: unknown) {
  if (typeof roleValue !== "string") {
    return [] as string[];
  }

  return roleValue
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function hasRole(roleValue: unknown, role: string) {
  return normalizeRoleList(roleValue).includes(role.toLowerCase());
}

export function isAdminRole(roleValue: unknown) {
  return hasRole(roleValue, "admin");
}

export async function getUserArticleWriteAccess(userId: string, roleValue: unknown) {
  if (isAdminRole(roleValue)) {
    return true;
  }

  const { rows } = await pool.query<UserArticlePermissionRow>(
    `
      select user_id, can_manage_articles
      from user_article_permissions
      where user_id = $1
      limit 1
    `,
    [userId]
  ).catch((error: unknown) => {
    if (isUndefinedTableError(error)) {
      return { rows: [] as UserArticlePermissionRow[] };
    }

    throw error;
  });

  return Boolean(rows[0]?.can_manage_articles);
}

export async function getUserArticleWriteAccessMap(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, boolean>();
  }

  const { rows } = await pool.query<UserArticlePermissionRow>(
    `
      select user_id, can_manage_articles
      from user_article_permissions
      where user_id = any($1::text[])
    `,
    [userIds]
  ).catch((error: unknown) => {
    if (isUndefinedTableError(error)) {
      return { rows: [] as UserArticlePermissionRow[] };
    }

    throw error;
  });

  return new Map(rows.map((row) => [row.user_id, Boolean(row.can_manage_articles)]));
}

export async function adminSetUserArticleWriteAccess(
  userId: string,
  canManageArticles: boolean,
  updatedByUserId: string
) {
  if (canManageArticles) {
    await pool.query(
      `
        insert into user_article_permissions (
          user_id,
          can_manage_articles,
          updated_by,
          updated_at
        )
        values ($1, true, $2, now())
        on conflict (user_id)
        do update
          set can_manage_articles = excluded.can_manage_articles,
              updated_by = excluded.updated_by,
              updated_at = now()
      `,
      [userId, updatedByUserId]
    );

    return;
  }

  await pool.query(
    `
      delete from user_article_permissions
      where user_id = $1
    `,
    [userId]
  );
}
