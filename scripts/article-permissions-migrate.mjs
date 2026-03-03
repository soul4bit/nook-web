import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for article permissions migrations.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const migrationSql = `
  create table if not exists user_article_permissions (
    user_id text primary key references "user"(id) on delete cascade,
    can_manage_articles boolean not null default false,
    updated_by text references "user"(id) on delete set null,
    updated_at timestamptz not null default now()
  );

  create index if not exists user_article_permissions_manage_idx
    on user_article_permissions(can_manage_articles, updated_at desc);
`;

try {
  await pool.query(migrationSql);
  console.log("Article permissions migration completed.");
} finally {
  await pool.end();
}
