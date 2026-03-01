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
  authorId: string;
  authorName: string;
  updatedById: string | null;
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
  topic: ArticleTopic;
  category?: string;
  summary: string;
  contentHtml: string;
  contentJson: Record<string, unknown>;
  contentText: string;
};

export type CreateArticleInput = SaveArticleInput & {
  authorId: string;
  editorId: string;
  title: string;
};

export type UpdateArticleInput = SaveArticleInput & {
  editorId: string;
  title: string;
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
    authorId: row.author_id,
    authorName,
    updatedById: row.updated_by_id,
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
    authorId: article.authorId,
    authorName: article.authorName,
    updatedById: article.updatedById,
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

async function createUniqueSlug(title: string, excludeId?: string) {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const { rows } = await pool.query<{ id: string }>(
      `
        select id
        from articles
        where slug = $1
          and ($2::text is null or id <> $2)
        limit 1
      `,
      [slug, excludeId ?? null]
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

export async function listArticles() {
  const { rows } = await pool.query<ArticleRow>(
    `
      ${articleSelectSql()}
      order by articles.updated_at desc
    `
  );

  return rows.map((row) => toListItem(mapArticle(row)));
}

export async function searchArticles(query: string) {
  const normalizedQuery = query.trim().slice(0, 180);

  if (!normalizedQuery) {
    return listArticles();
  }

  const searchVectorSql = articleSearchVectorSql();
  const { rows } = await pool.query<ArticleRow>(
    `
      ${articleSelectSql()}
      where ${searchVectorSql} @@ plainto_tsquery('simple', $1)
      order by
        ts_rank(${searchVectorSql}, plainto_tsquery('simple', $1)) desc,
        articles.updated_at desc
    `,
    [normalizedQuery]
  );

  return rows.map((row) => toListItem(mapArticle(row)));
}

export async function getArticleById(articleId: string) {
  const { rows } = await pool.query<ArticleRow>(
    `
      ${articleSelectSql()}
      where articles.id = $1
      limit 1
    `,
    [articleId]
  );

  return rows[0] ? mapArticle(rows[0]) : null;
}

export async function createArticle(input: CreateArticleInput) {
  const id = randomUUID();
  const slug = await createUniqueSlug(input.title);
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

  return (await getArticleById(rows[0].id)) as ArticleRecord;
}

export async function updateArticle(articleId: string, input: UpdateArticleInput) {
  const slug = await createUniqueSlug(input.title, articleId);
  const summary = normalizeSummary(input.summary, input.contentText);
  const contentMarkdown = tiptapJsonToMarkdown(input.contentJson, input.contentText);

  const { rows } = await pool.query<ArticleRow>(
    `
      update articles
      set
        title = $2,
        slug = $3,
        topic = $4,
        category = $5,
        summary = $6,
        content_html = $7,
        content_markdown = $8,
        content_json = $9::jsonb,
        content_text = $10,
        updated_by_id = $11,
        updated_at = now()
      where id = $1
      returning
        *,
        null::text as author_name,
        null::text as updated_by_name
    `,
    [
      articleId,
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

  return getArticleById(rows[0].id);
}

export async function deleteArticle(articleId: string, actorId: string, actorIsAdmin: boolean) {
  const { rows } = await pool.query<{ author_id: string }>(
    `
      select author_id
      from articles
      where id = $1
      limit 1
    `,
    [articleId]
  );

  const article = rows[0];

  if (!article) {
    return "not_found" as const;
  }

  if (!actorIsAdmin && article.author_id !== actorId) {
    return "forbidden" as const;
  }

  await pool.query(
    `
      delete from articles
      where id = $1
    `,
    [articleId]
  );

  return "deleted" as const;
}
