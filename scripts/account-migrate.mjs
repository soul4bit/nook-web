import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for account migrations.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const migrationSql = `
  create table if not exists user_password_change (
    user_id text primary key references "user"(id) on delete cascade,
    changed_at timestamptz not null default now()
  );
`;

try {
  await pool.query(migrationSql);
  console.log("Account migration completed.");
} finally {
  await pool.end();
}
