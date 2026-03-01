import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for article migrations.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const migrationSql = `
  create table if not exists articles (
    id text primary key,
    author_id text not null references "user"(id) on delete cascade,
    updated_by_id text references "user"(id) on delete set null,
    title text not null,
    slug text not null,
    topic text not null,
    category text not null default 'Общее',
    summary text not null,
    content_html text not null,
    content_markdown text not null default '',
    content_json jsonb not null,
    content_text text not null,
    cover_image_path text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  alter table articles
    add column if not exists updated_by_id text references "user"(id) on delete set null;

  alter table articles
    add column if not exists category text not null default 'Общее';

  alter table articles
    add column if not exists content_markdown text not null default '';

  update articles
  set updated_by_id = author_id
  where updated_by_id is null;

  update articles
  set category = 'Общее'
  where category is null or btrim(category) = '';

  update articles
  set content_markdown = content_text
  where content_markdown is null or btrim(content_markdown) = '';

  create unique index if not exists articles_author_slug_idx
    on articles(author_id, slug);

  create index if not exists articles_slug_idx
    on articles(slug);

  create index if not exists articles_updated_idx
    on articles(updated_at desc);

  create index if not exists articles_topic_category_idx
    on articles(topic, category, updated_at desc);

  create index if not exists articles_author_updated_idx
    on articles(author_id, updated_at desc);

  create index if not exists articles_author_topic_category_idx
    on articles(author_id, topic, category, updated_at desc);

  create index if not exists articles_search_tsv_idx
    on articles using gin (
      to_tsvector(
        'simple',
        coalesce(title, '') || ' ' ||
        coalesce(summary, '') || ' ' ||
        coalesce(content_text, '') || ' ' ||
        coalesce(content_markdown, '')
      )
    );
`;

try {
  await pool.query(migrationSql);
  console.log("Articles migration completed.");
} finally {
  await pool.end();
}
