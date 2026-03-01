import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  BookOpenText,
  Boxes,
  Cable,
  Clock3,
  FolderKanban,
  HardDriveUpload,
  PenSquare,
  Plus,
  SearchSlash,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundCog,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { ThoughtEditor } from "@/components/editor/thought-editor";
import { ArticleContent } from "@/components/articles/article-content";
import { UserAvatar } from "@/components/user/user-avatar";
import { Button } from "@/components/ui/button";
import { getCurrentSession, isAdminSession } from "@/lib/auth/session";
import {
  getArticleById,
  isArticleTopic,
  listArticles,
  searchArticles,
} from "@/lib/articles/server";
import { articleTopics } from "@/lib/content/devops-library";

const copy = {
  workspace: "Приватная wiki",
  workspaceText:
    "Это общая база знаний команды: все авторизованные пользователи работают с единой структурой разделов, категорий и статей.",
  newArticle: "Новая заметка",
  account: "Личный кабинет",
  admin: "Админ-панель",
  sections: "Разделы",
  articlesSuffix: "статей",
  noArticlesInSection:
    "В этой категории пока нет материалов. Создайте первую заметку через редактор справа.",
  currentSection: "Текущий контур",
  sectionCount: "статей в категории",
  heroTitle: "База знаний, где ответы находятся за секунды.",
  heroText:
    "Откройте тему, выберите категорию и работайте с общей базой в одном окне: слева структура, справа чтение и редактирование.",
  snapshot: "Состояние",
  allArticles: "Всего статей",
  lastUpdate: "Последнее обновление",
  emptyValue: "Пока нет данных",
  updated: "Обновлено",
  created: "Создано",
  author: "Автор",
  lastEditor: "Последний редактор",
  reading: "Просмотр статьи",
  nothingToRead: "Статья не выбрана",
  nothingToReadText:
    "Выберите материал в списке слева или создайте новый. После сохранения он сразу появится в нужной категории.",
  editor: "Редактор",
  editArticle: "Редактирование статьи",
  newNote: "Создание статьи",
  editorText:
    "Материал сохраняется в PostgreSQL в формате markdown + html и сразу становится доступен в списке категории.",
  searchPlaceholder: "Поиск по заголовку, описанию и тексту",
  searchButton: "Найти",
  clearSearch: "Сброс",
  searchResult: "Результаты поиска",
} as const;

const topicIcons = {
  Linux: ServerCog,
  Docker: Boxes,
  "\u0421\u0435\u0442\u0438": Cable,
  Ansible: FolderKanban,
  K8S: HardDriveUpload,
  Terraform: FolderKanban,
  "CI/CD": Sparkles,
} as const;

type AppPageProps = {
  searchParams?: Promise<{
    article?: string;
    topic?: string;
    category?: string;
    draft?: string;
    q?: string;
  }>;
};

function buildAppHref(
  topic: string,
  options?: {
    articleId?: string;
    draft?: boolean;
    category?: string;
    query?: string;
  }
) {
  const params = new URLSearchParams({ topic });

  if (options?.category) {
    params.set("category", options.category);
  }

  if (options?.articleId) {
    params.set("article", options.articleId);
  }

  if (options?.draft) {
    params.set("draft", "1");
  }

  if (options?.query?.trim()) {
    params.set("q", options.query.trim());
  }

  return `/app?${params.toString()}`;
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AppPage({ searchParams }: AppPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth");
  }

  const params = searchParams ? await searchParams : undefined;
  const requestedTopic =
    params?.topic && isArticleTopic(params.topic) ? params.topic : null;
  const requestedCategory = params?.category?.trim() || null;
  const requestedArticleId = params?.article;
  const draftMode = params?.draft === "1";
  const searchQuery = params?.q?.trim().slice(0, 180) ?? "";
  const allArticles = await listArticles();
  const articles = searchQuery
    ? await searchArticles(searchQuery)
    : allArticles;
  const requestedArticle = requestedArticleId
    ? await getArticleById(requestedArticleId)
    : null;

  const selectedTopic = requestedArticle?.topic ?? requestedTopic ?? articleTopics[0].name;
  const topicArticles = articles.filter((article) => article.topic === selectedTopic);
  const topicCategoryMap = Object.fromEntries(
    articleTopics.map((topic) => [
      topic.name,
      Array.from(
        new Set([
          ...topic.categories,
          ...allArticles
            .filter((article) => article.topic === topic.name)
            .map((article) => article.category),
          "Общее",
        ])
      ),
    ])
  ) as Record<string, string[]>;
  const currentTopic =
    articleTopics.find((topic) => topic.name === selectedTopic) ?? articleTopics[0];
  const selectedCategory =
    requestedArticle?.category ??
    requestedCategory ??
    topicArticles[0]?.category ??
    currentTopic.categories[0] ??
    "Общее";
  const categoryArticles = topicArticles.filter(
    (article) => article.category === selectedCategory
  );
  const selectedArticleSummary = draftMode
    ? null
    : requestedArticle && requestedArticle.topic === selectedTopic
      ? requestedArticle
      : categoryArticles[0] ?? null;
  const selectedArticle =
    selectedArticleSummary &&
    (!requestedArticle || requestedArticle.id !== selectedArticleSummary.id)
      ? await getArticleById(selectedArticleSummary.id)
      : draftMode
        ? null
        : requestedArticle;

  const displayName = session.user.name?.trim() || session.user.email;
  const isAdmin = isAdminSession(session);
  const totalArticles = allArticles.length;
  const visibleArticlesCount = articles.length;
  const hasSearchQuery = Boolean(searchQuery);
  const seenSlugs = new Set<string>();
  const wikiLinks = allArticles
    .filter((article) => {
      if (seenSlugs.has(article.slug)) {
        return false;
      }

      seenSlugs.add(article.slug);
      return true;
    })
    .map((article) => ({
      slug: article.slug,
      title: article.title,
      href: buildAppHref(article.topic, {
        articleId: article.id,
        category: article.category,
      }),
    }));

  return (
    <div className="min-h-screen px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1640px] flex-col overflow-hidden rounded-[32px] border border-slate-700/80 bg-[#0b141e]/95 shadow-[0_40px_120px_rgba(2,8,15,0.75)] lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-slate-700/80 bg-[#101d2a]/90 p-5 lg:max-w-[340px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <KnowledgeLogo subtitle="Общая DevOps-вики" />

            <SignOutButton />
          </div>

          <div className="mt-7 rounded-[24px] border border-slate-700/80 bg-[#132230]/85 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {copy.workspace}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <UserAvatar
                image={session.user.image}
                name={displayName}
                className="size-12 rounded-2xl border-slate-600/70 bg-[#1c3044]"
                fallbackClassName="text-[#56e3c2]"
              />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-100">
                  {displayName}
                </h1>
                <p className="mt-1 truncate text-sm text-slate-500">{session.user.email}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-400">{copy.workspaceText}</p>

            <div className="mt-5 grid gap-3">
              <Button
                asChild
                className="h-11 w-full rounded-2xl bg-[#21ab8f] text-white hover:bg-[#1b947d]"
              >
                <Link
                  href={buildAppHref(selectedTopic, {
                    draft: true,
                    category: selectedCategory,
                    query: searchQuery || undefined,
                  })}
                >
                  <Plus className="size-4" />
                  {copy.newArticle}
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-11 w-full rounded-2xl border-slate-600/70 bg-[#172a3b] text-slate-200 hover:bg-[#1c3044]"
              >
                <Link href="/app/account">
                  <UserRoundCog className="size-4" />
                  {copy.account}
                </Link>
              </Button>

              {isAdmin ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full rounded-2xl border-slate-600/70 bg-[#172a3b] text-slate-200 hover:bg-[#1c3044]"
                >
                  <Link href="/app/admin">
                    <ShieldCheck className="size-4" />
                    {copy.admin}
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-slate-700/80 bg-[#152638]/85 p-3">
            <form action="/app" method="get" className="space-y-2">
              <input type="hidden" name="topic" value={selectedTopic} />
              <input type="hidden" name="category" value={selectedCategory} />
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  name="q"
                  defaultValue={searchQuery}
                  placeholder={copy.searchPlaceholder}
                  className="h-10 w-full rounded-xl border border-slate-700/80 bg-[#0f1b28] px-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-[#56e3c2] focus-visible:outline-none"
                />
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-[#21ab8f] px-3 text-sm font-semibold text-white hover:bg-[#1b947d]"
                >
                  {copy.searchButton}
                </button>
              </div>
            </form>
            {hasSearchQuery ? (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {copy.searchResult}: {visibleArticlesCount}
                </p>
                <Link
                  href={buildAppHref(selectedTopic, {
                    category: selectedCategory,
                  })}
                  className="text-xs font-semibold text-[#56e3c2] hover:underline"
                >
                  {copy.clearSearch}
                </Link>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex-1 overflow-y-auto pr-1">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {copy.sections}
              </p>
              <span className="rounded-full border border-slate-700/80 bg-[#152638] px-2.5 py-1 text-xs text-slate-400">
                {hasSearchQuery ? `${visibleArticlesCount}/${totalArticles}` : totalArticles}{" "}
                {copy.articlesSuffix}
              </span>
            </div>

            <nav className="space-y-3">
              {articleTopics.map((topic) => {
                const Icon = topicIcons[topic.name];
                const isActive = topic.name === selectedTopic;
                const nestedArticles = articles.filter(
                  (article) => article.topic === topic.name
                );
                const nestedCategories = Array.from(
                  new Set([...topic.categories, ...nestedArticles.map((article) => article.category)])
                );

                return (
                  <div
                    key={topic.name}
                    className={`rounded-[20px] border transition-colors ${
                      isActive
                        ? "border-[#31495f] bg-[#132839]"
                        : "border-slate-600/70 bg-[#0f1b28]"
                    }`}
                  >
                    <Link
                      href={buildAppHref(topic.name, {
                        query: searchQuery || undefined,
                      })}
                      className="flex items-start gap-3 px-4 py-4"
                    >
                      <div
                        className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${
                          isActive
                            ? "bg-[#1c3850] text-[#56e3c2]"
                            : "bg-[#1c3044] text-slate-500"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-slate-100">{topic.name}</h2>
                          <span className="text-xs text-slate-500">{nestedArticles.length}</span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{topic.summary}</p>
                      </div>
                    </Link>

                    {isActive ? (
                      <div className="border-t border-slate-700/80 px-3 py-3">
                        {nestedCategories.length > 0 ? (
                          <div className="space-y-4">
                            {nestedCategories.map((categoryName) => {
                              const groupedArticles = nestedArticles.filter(
                                (article) => article.category === categoryName
                              );
                              const isCategoryActive = categoryName === selectedCategory;

                              return (
                                <div key={categoryName} className="space-y-2">
                                  <Link
                                    href={buildAppHref(topic.name, {
                                      category: categoryName,
                                      query: searchQuery || undefined,
                                    })}
                                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                                      isCategoryActive
                                        ? "bg-[#1c3850] text-[#56e3c2]"
                                        : "bg-[#0f1b28] text-slate-500 hover:bg-[#152230]"
                                    }`}
                                  >
                                    <span>{categoryName}</span>
                                    <span>{groupedArticles.length}</span>
                                  </Link>

                                  {groupedArticles.length > 0 ? (
                                    <div className="space-y-2">
                                      {groupedArticles.map((article) => {
                                        const isSelected = article.id === selectedArticle?.id;

                                        return (
                                          <Link
                                            key={article.id}
                                            href={buildAppHref(topic.name, {
                                              articleId: article.id,
                                              category: categoryName,
                                              query: searchQuery || undefined,
                                            })}
                                            className={`block rounded-xl border px-3 py-3 transition-colors ${
                                              isSelected
                                                ? "border-[#355b73] bg-[#0f1b28] text-slate-100 shadow-sm"
                                                : "border-slate-600/70 bg-[#172a3b] text-slate-200 hover:bg-[#0f1b28]"
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">
                                                  {article.title}
                                                </p>
                                                <p
                                                  className={`mt-1 line-clamp-2 text-xs leading-5 ${
                                                    isSelected
                                                      ? "text-slate-400"
                                                      : "text-slate-500"
                                                  }`}
                                                >
                                                  {article.summary}
                                                </p>
                                              </div>
                                              <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                                            </div>
                                          </Link>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="rounded-xl border border-dashed border-slate-700/80 bg-[#0f1b28] px-3 py-3 text-sm leading-6 text-slate-500">
                                      В этой категории пока нет статей.
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-700/80 bg-[#0f1b28] px-3 py-4 text-sm leading-6 text-slate-500">
                            {copy.noArticlesInSection}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-5 p-5 lg:p-6">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
            <div className="rounded-[28px] border border-slate-700/80 bg-[#132230]/85 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {copy.currentSection}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full bg-[#1c3850] px-3 py-1 text-sm font-semibold text-[#56e3c2]">
                  {currentTopic.name}
                </span>
                <span className="inline-flex rounded-full border border-slate-600/70 bg-[#152230] px-3 py-1 text-sm font-medium text-slate-300">
                  {selectedCategory}
                </span>
                <span className="text-sm text-slate-500">
                  {categoryArticles.length} {copy.sectionCount}
                </span>
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-slate-100 sm:text-[2.35rem]">
                {copy.heroTitle}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
                {copy.heroText}
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-700/80 bg-[#132230]/85 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {copy.snapshot}
              </p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-[18px] border border-slate-600/70 bg-[#172a3b] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {copy.allArticles}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">{totalArticles}</p>
                </div>
                <div className="rounded-[18px] border border-slate-600/70 bg-[#172a3b] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Категория
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{selectedCategory}</p>
                </div>
                <div className="rounded-[18px] border border-slate-600/70 bg-[#172a3b] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {copy.lastUpdate}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">
                    {articles[0] ? formatDateTime(articles[0].updatedAt) : copy.emptyValue}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-[28px] border border-slate-700/80 bg-[#132230]/85 p-6">
              {selectedArticle ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex rounded-full bg-[#1c3850] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#56e3c2]">
                      {selectedArticle.topic}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-600/70 bg-[#152230] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {selectedArticle.category}
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="size-3.5" />
                      {copy.updated} {formatDateTime(selectedArticle.updatedAt)}
                    </span>
                  </div>

                  <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-100">
                    {selectedArticle.title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
                    {selectedArticle.summary}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-600/70 bg-[#172a3b] px-4 py-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                        <UserRound className="size-3.5" />
                        {copy.author}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-100">
                        {selectedArticle.authorName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {copy.created} {formatDateTime(selectedArticle.createdAt)}
                      </p>
                    </div>

                    <div className="rounded-[18px] border border-slate-600/70 bg-[#172a3b] px-4 py-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                        <PenSquare className="size-3.5" />
                        {copy.lastEditor}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-100">
                        {selectedArticle.updatedByName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {copy.updated} {formatDateTime(selectedArticle.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[22px] border border-slate-600/70 bg-[#0f1b28] p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
                      <BookOpenText className="size-4 text-[#56e3c2]" />
                      {copy.reading}
                    </div>
                    <ArticleContent
                      html={selectedArticle.contentHtml}
                      wikiLinks={wikiLinks}
                      className="max-w-none space-y-4 text-sm leading-7 text-slate-300"
                    />
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-700/80 bg-[#0f1b28] px-8 text-center">
                  <div className="flex size-14 items-center justify-center rounded-3xl bg-[#1a3348] text-[#56e3c2]">
                    <SearchSlash className="size-6" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-slate-100">
                    {copy.nothingToRead}
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-7 text-slate-400">
                    {copy.nothingToReadText}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-slate-700/80 bg-[#132230]/85 p-6">
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {copy.editor}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-100">
                  {selectedArticle ? copy.editArticle : copy.newNote}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">{copy.editorText}</p>
              </div>

              <ThoughtEditor
                article={selectedArticle}
                topics={articleTopics.map((topic) => topic.name)}
                defaultTopic={selectedTopic}
                topicCategories={topicCategoryMap as Record<
                  (typeof articleTopics)[number]["name"],
                  string[]
                >}
                defaultCategory={selectedCategory}
                canDeleteArticle={
                  selectedArticle
                    ? selectedArticle.authorId === session.user.id || isAdmin
                    : false
                }
                wikiLinks={wikiLinks}
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}




