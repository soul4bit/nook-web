import { randomUUID } from "crypto";
import { pool } from "@/lib/auth/server";
import { articleTopicNames, type ArticleTopic } from "@/lib/content/devops-library";
import { tiptapJsonToMarkdown } from "@/lib/articles/markdown";

type ArticleRow = {
  id: string;
  author_id: string;
  author_name: string | null;
  updated_by_id: string | null;
  updated_by_name: string | null;
  title: string;
  slug: string;
  topic: string;
  category: string;
  summary: string;
  content_html: string;
  content_markdown: string;
  content_json: Record<string, unknown>;
  content_text: string;
  cover_image_path: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ArticleListItem = {
  id: string;
  title: string;
  slug: string;
  topic: ArticleTopic;
  category: string;
  summary: string;
  authorName: string;
  updatedByName: string;
  updatedAt: string;
};

export type ArticleRecord = ArticleListItem & {
  contentHtml: string;
  contentMarkdown: string;
  contentJson: Record<string, unknown>;
  contentText: string;
  coverImagePath: string | null;
  createdAt: string;
};

export type SaveArticleInput = {
  authorId: string;
  editorId: string;
  title: string;
  topic: ArticleTopic;
  category?: string;
  summary: string;
  contentHtml: string;
  contentJson: Record<string, unknown>;
  contentText: string;
};

function articleSearchVectorSql() {
  return `
    to_tsvector(
      'simple',
      coalesce(articles.title, '') || ' ' ||
      coalesce(articles.summary, '') || ' ' ||
      coalesce(articles.content_text, '') || ' ' ||
      coalesce(articles.content_markdown, '')
    )
  `;
}

function mapArticle(row: ArticleRow): ArticleRecord {
  const authorName = row.author_name?.trim() || "\u0410\u0432\u0442\u043e\u0440";
  const updatedByName = row.updated_by_name?.trim() || authorName;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    topic: row.topic as ArticleTopic,
    category: row.category,
    summary: row.summary,
    authorName,
    updatedByName,
    contentHtml: row.content_html,
    contentMarkdown: row.content_markdown,
    contentJson: row.content_json,
    contentText: row.content_text,
    coverImagePath: row.cover_image_path,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toListItem(article: ArticleRecord): ArticleListItem {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    topic: article.topic,
    category: article.category,
    summary: article.summary,
    authorName: article.authorName,
    updatedByName: article.updatedByName,
    updatedAt: article.updatedAt,
  };
}

function normalizeSummary(summary: string, contentText: string) {
  const cleanedSummary = summary.trim();

  if (cleanedSummary) {
    return cleanedSummary.slice(0, 240);
  }

  return contentText.trim().replace(/\s+/g, " ").slice(0, 240);
}

function normalizeCategory(category?: string) {
  const cleaned = category?.trim();
  return cleaned ? cleaned.slice(0, 80) : "\u041e\u0431\u0449\u0435\u0435";
}

function slugify(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "article";
}

async function createUniqueSlug(authorId: string, title: string, excludeId?: string) {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const { rows } = await pool.query<{ id: string }>(
      `
        select id
        from articles
        where author_id = $1
          and slug = $2
          and ($3::text is null or id <> $3)
        limit 1
      `,
      [authorId, slug, excludeId ?? null]
    );

    if (rows.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function articleSelectSql() {
  return `
    select
      articles.*,
      author_user.name as author_name,
      updated_user.name as updated_by_name
    from articles
    left join "user" as author_user on author_user.id = articles.author_id
    left join "user" as updated_user on updated_user.id = articles.updated_by_id
  `;
}

export function isArticleTopic(value: string): value is ArticleTopic {
  return articleTopicNames.includes(value as ArticleTopic);
}

export async function listArticlesByAuthor(authorId: string) {
  const { rows } = await pool.query<ArticleRow>(
    `
      ${articleSelectSql()}
      where articles.author_id = $1
      order by articles.updated_at desc
    `,
    [authorId]
  );

  return rows.map((row) => toListItem(mapArticle(row)));
}

export async function searchArticlesByAuthor(authorId: string, query: string) {
  const normalizedQuery = query.trim().slice(0, 180);

  if (!normalizedQuery) {
    return listArticlesByAuthor(authorId);
  }

  const searchVectorSql = articleSearchVectorSql();
  const { rows } = await pool.query<ArticleRow>(
    `
      ${articleSelectSql()}
      where articles.author_id = $1
        and ${searchVectorSql} @@ plainto_tsquery('simple', $2)
      order by
        ts_rank(${searchVectorSql}, plainto_tsquery('simple', $2)) desc,
        articles.updated_at desc
    `,
    [authorId, normalizedQuery]
  );

  return rows.map((row) => toListItem(mapArticle(row)));
}

export async function getArticleById(authorId: string, articleId: string) {
  const { rows } = await pool.query<ArticleRow>(
    `
      ${articleSelectSql()}
      where articles.id = $1 and articles.author_id = $2
      limit 1
    `,
    [articleId, authorId]
  );

  return rows[0] ? mapArticle(rows[0]) : null;
}

export async function createArticle(input: SaveArticleInput) {
  const id = randomUUID();
  const slug = await createUniqueSlug(input.authorId, input.title);
  const summary = normalizeSummary(input.summary, input.contentText);
  const contentMarkdown = tiptapJsonToMarkdown(input.contentJson, input.contentText);

  const { rows } = await pool.query<ArticleRow>(
    `
      insert into articles (
        id,
        author_id,
        updated_by_id,
        title,
        slug,
        topic,
        category,
        summary,
        content_html,
        content_markdown,
        content_json,
        content_text,
        cover_image_path
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, null)
      returning
        *,
        null::text as author_name,
        null::text as updated_by_name
    `,
    [
      id,
      input.authorId,
      input.editorId,
      input.title.trim(),
      slug,
      input.topic,
      normalizeCategory(input.category),
      summary,
      input.contentHtml,
      contentMarkdown,
      JSON.stringify(input.contentJson),
      input.contentText,
    ]
  );

  return (await getArticleById(input.authorId, rows[0].id)) as ArticleRecord;
}

export async function updateArticle(articleId: string, input: SaveArticleInput) {
  const slug = await createUniqueSlug(input.authorId, input.title, articleId);
  const summary = normalizeSummary(input.summary, input.contentText);
  const contentMarkdown = tiptapJsonToMarkdown(input.contentJson, input.contentText);

  const { rows } = await pool.query<ArticleRow>(
    `
      update articles
      set
        title = $3,
        slug = $4,
        topic = $5,
        category = $6,
        summary = $7,
        content_html = $8,
        content_markdown = $9,
        content_json = $10::jsonb,
        content_text = $11,
        updated_by_id = $12,
        updated_at = now()
      where id = $1 and author_id = $2
      returning
        *,
        null::text as author_name,
        null::text as updated_by_name
    `,
    [
      articleId,
      input.authorId,
      input.title.trim(),
      slug,
      input.topic,
      normalizeCategory(input.category),
      summary,
      input.contentHtml,
      contentMarkdown,
      JSON.stringify(input.contentJson),
      input.contentText,
      input.editorId,
    ]
  );

  if (!rows[0]) {
    return null;
  }

  return getArticleById(input.authorId, rows[0].id);
}

export async function deleteArticle(authorId: string, articleId: string) {
  const { rowCount } = await pool.query(
    `
      delete from articles
      where id = $1 and author_id = $2
    `,
    [articleId, authorId]
  );

  return (rowCount ?? 0) > 0;
}
