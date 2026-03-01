import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for auth guard migrations.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const migrationSql = `
  create table if not exists auth_guard_events (
    id bigserial primary key,
    action text not null,
    ip_address text not null,
    email text,
    created_at timestamptz not null default now()
  );

  create index if not exists auth_guard_events_action_ip_created_idx
    on auth_guard_events(action, ip_address, created_at desc);

  create index if not exists auth_guard_events_action_email_created_idx
    on auth_guard_events(action, email, created_at desc);

  create table if not exists auth_guard_logs (
    id bigserial primary key,
    event_type text not null,
    action text not null,
    code text not null,
    reason text not null,
    status integer not null,
    ip_address text not null,
    email text,
    user_agent text not null,
    details jsonb,
    created_at timestamptz not null default now()
  );

  create index if not exists auth_guard_logs_created_idx
    on auth_guard_logs(created_at desc);

  create index if not exists auth_guard_logs_action_created_idx
    on auth_guard_logs(action, created_at desc);

  create index if not exists auth_guard_logs_email_created_idx
    on auth_guard_logs(email, created_at desc);

  create index if not exists auth_guard_logs_ip_created_idx
    on auth_guard_logs(ip_address, created_at desc);
`;

try {
  await pool.query(migrationSql);
  console.log("Auth guard migration completed.");
} finally {
  await pool.end();
}
