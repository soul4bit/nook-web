import { pool } from "@/lib/auth/server";

const PASSWORD_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type PasswordChangeRow = {
  changed_at: Date | string;
};

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export async function getPasswordChangeStatus(userId: string) {
  const result = await pool.query<PasswordChangeRow>(
    `
      select changed_at
      from user_password_change
      where user_id = $1
      limit 1
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    return {
      canChange: true,
      lastChangedAt: null,
      nextAllowedAt: null,
    };
  }

  const lastChangedAt = toDate(result.rows[0].changed_at);
  const nextAllowedAt = new Date(lastChangedAt.getTime() + PASSWORD_CHANGE_COOLDOWN_MS);

  return {
    canChange: nextAllowedAt.getTime() <= Date.now(),
    lastChangedAt,
    nextAllowedAt,
  };
}

export async function markPasswordChanged(userId: string) {
  const result = await pool.query<PasswordChangeRow>(
    `
      insert into user_password_change (user_id, changed_at)
      values ($1, now())
      on conflict (user_id)
      do update set changed_at = excluded.changed_at
      returning changed_at
    `,
    [userId]
  );

  return toDate(result.rows[0].changed_at);
}
