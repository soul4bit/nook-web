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
  Sparkles,
  UserRound,
  UserRoundCog,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThoughtEditor } from "@/components/editor/thought-editor";
import { UserAvatar } from "@/components/user/user-avatar";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getArticleById,
  isArticleTopic,
  listArticlesByAuthor,
} from "@/lib/articles/server";
import { articleTopics } from "@/lib/content/devops-library";

const copy = {
  workspace: "Личное пространство",
  workspaceText:
    "Вся база по Linux, Docker, сетям, Ansible, Kubernetes, Terraform и CI/CD в одном интерфейсе: слева разделы и статьи, справа чтение и редактирование.",
  newArticle: "Новая статья",
  account: "Личный кабинет",
  sections: "Разделы",
  articlesSuffix: "статей",
  noArticlesInSection:
    "В этом разделе пока нет статей. Создайте первую заметку через редактор справа.",
  currentSection: "Текущий раздел",
  sectionCount: "статей в категории",
  heroTitle: "База знаний, в которой легко найти нужный ответ.",
  heroText:
    "Откройте тему, выберите категорию и читайте статью рядом с редактором. Можно быстро обновлять материал и сразу видеть итоговый текст.",
  snapshot: "Сводка",
  allArticles: "Всего статей",
  lastUpdate: "Последнее обновление",
  emptyValue: "Пока нет данных",
  updated: "Обновлено",
  created: "Создано",
  author: "Автор",
  lastEditor: "Последний редактор",
  reading: "Чтение статьи",
  nothingToRead: "Пока нечего читать",
  nothingToReadText:
    "Выберите категорию со статьями или создайте новую заметку. Как только сохраните материал, он сразу появится в списке.",
  editor: "Редактор",
  editArticle: "Редактирование статьи",
  newNote: "Новая заметка",
  editorText:
    "Сохранение идет в PostgreSQL в формате markdown + html. После сохранения материал сразу отображается в списке категории.",
} as const;

const topicIcons = {
  Linux: ServerCog,
  Docker: Boxes,
  Сети: Cable,
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
  }>;
};

function buildAppHref(
  topic: string,
  options?: { articleId?: string; draft?: boolean; category?: string }
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
  const articles = await listArticlesByAuthor(session.user.id);
  const requestedArticle = requestedArticleId
    ? await getArticleById(session.user.id, requestedArticleId)
    : null;

  const selectedTopic = requestedArticle?.topic ?? requestedTopic ?? articleTopics[0].name;
  const topicArticles = articles.filter((article) => article.topic === selectedTopic);
  const topicCategoryMap = Object.fromEntries(
    articleTopics.map((topic) => [
      topic.name,
      Array.from(
        new Set([
          ...topic.categories,
          ...articles
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
      ? await getArticleById(session.user.id, selectedArticleSummary.id)
      : draftMode
        ? null
        : requestedArticle;

  const displayName = session.user.name?.trim() || session.user.email;
  const totalArticles = articles.length;

  return (
    <div className="min-h-screen px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1640px] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-[#f7f9fb]/95 shadow-[0_24px_90px_rgba(15,23,42,0.08)] lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-[#f2f6fa] p-5 lg:max-w-[340px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-16 items-center justify-center overflow-hidden rounded-[16px] border border-[#bfcede] bg-white">
                <div className="absolute left-2 h-3 w-2 rounded-full bg-[#3b82a4]" />
                <div className="absolute left-5 top-3 h-6 w-4 rounded-l-[18px] rounded-r-[6px] bg-[#3b82a4]" />
                <div className="absolute left-7 top-2 h-8 w-3 rotate-[32deg] rounded-full bg-[#3b82a4]" />
                <div className="absolute right-5 top-3 h-6 w-4 rounded-l-[6px] rounded-r-[18px] bg-[#3b82a4]" />
                <div className="absolute right-2 h-3 w-2 rounded-full bg-[#3b82a4]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#50758a]">
                  Контур Знаний
                </p>
                <p className="text-sm text-slate-600">Личная DevOps-вики</p>
              </div>
            </div>

            <SignOutButton />
          </div>

          <div className="mt-7 rounded-[24px] border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {copy.workspace}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <UserAvatar
                image={session.user.image}
                name={displayName}
                className="size-12 rounded-2xl border-slate-200 bg-slate-100"
                fallbackClassName="text-[#3b82a4]"
              />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">
                  {displayName}
                </h1>
                <p className="mt-1 truncate text-sm text-slate-500">{session.user.email}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{copy.workspaceText}</p>

            <div className="mt-5 grid gap-3">
              <Button
                asChild
                className="h-11 w-full rounded-2xl bg-[#3b82a4] text-white hover:bg-[#327391]"
              >
                <Link
                  href={buildAppHref(selectedTopic, {
                    draft: true,
                    category: selectedCategory,
                  })}
                >
                  <Plus className="size-4" />
                  {copy.newArticle}
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-11 w-full rounded-2xl border-slate-200 bg-[#f8fafc] text-slate-800 hover:bg-slate-100"
              >
                <Link href="/app/account">
                  <UserRoundCog className="size-4" />
                  {copy.account}
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 flex-1 overflow-y-auto pr-1">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {copy.sections}
              </p>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                {totalArticles} {copy.articlesSuffix}
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
                        ? "border-[#b7d0df] bg-[#eaf4fb]"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <Link
                      href={buildAppHref(topic.name)}
                      className="flex items-start gap-3 px-4 py-4"
                    >
                      <div
                        className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${
                          isActive
                            ? "bg-[#3b82a4] text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-slate-900">{topic.name}</h2>
                          <span className="text-xs text-slate-500">{nestedArticles.length}</span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{topic.summary}</p>
                      </div>
                    </Link>

                    {isActive ? (
                      <div className="border-t border-[#d7e5ef] px-3 py-3">
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
                                    })}
                                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                                      isCategoryActive
                                        ? "bg-[#d6e9f4] text-[#2b5f79]"
                                        : "bg-white text-slate-500 hover:bg-slate-50"
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
                                            })}
                                            className={`block rounded-xl border px-3 py-3 transition-colors ${
                                              isSelected
                                                ? "border-[#9dc3d6] bg-white text-slate-900 shadow-sm"
                                                : "border-slate-200 bg-[#f8fafc] text-slate-800 hover:bg-white"
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
                                                      ? "text-slate-600"
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
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-[#f8fafc] px-3 py-3 text-sm leading-6 text-slate-500">
                                      В этой категории пока нет статей.
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-[#f8fafc] px-3 py-4 text-sm leading-6 text-slate-500">
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
            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {copy.currentSection}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full bg-[#d6e9f4] px-3 py-1 text-sm font-semibold text-[#2b5f79]">
                  {currentTopic.name}
                </span>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                  {selectedCategory}
                </span>
                <span className="text-sm text-slate-500">
                  {categoryArticles.length} {copy.sectionCount}
                </span>
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.35rem]">
                {copy.heroTitle}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                {copy.heroText}
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {copy.snapshot}
              </p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-[18px] border border-slate-200 bg-[#f8fafc] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {copy.allArticles}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{totalArticles}</p>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-[#f8fafc] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Категория
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{selectedCategory}</p>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-[#f8fafc] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {copy.lastUpdate}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {articles[0] ? formatDateTime(articles[0].updatedAt) : copy.emptyValue}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
              {selectedArticle ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex rounded-full bg-[#d6e9f4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#2b5f79]">
                      {selectedArticle.topic}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {selectedArticle.category}
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="size-3.5" />
                      {copy.updated} {formatDateTime(selectedArticle.updatedAt)}
                    </span>
                  </div>

                  <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
                    {selectedArticle.title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                    {selectedArticle.summary}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-200 bg-[#f8fafc] px-4 py-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                        <UserRound className="size-3.5" />
                        {copy.author}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {selectedArticle.authorName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {copy.created} {formatDateTime(selectedArticle.createdAt)}
                      </p>
                    </div>

                    <div className="rounded-[18px] border border-slate-200 bg-[#f8fafc] px-4 py-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                        <PenSquare className="size-3.5" />
                        {copy.lastEditor}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {selectedArticle.updatedByName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {copy.updated} {formatDateTime(selectedArticle.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[22px] border border-slate-200 bg-[#fbfcfe] p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <BookOpenText className="size-4 text-[#3b82a4]" />
                      {copy.reading}
                    </div>
                    <article
                      className="nook-editor max-w-none space-y-4 text-sm leading-7 text-slate-700"
                      dangerouslySetInnerHTML={{ __html: selectedArticle.contentHtml }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-[#f8fafc] px-8 text-center">
                  <div className="flex size-14 items-center justify-center rounded-3xl bg-[#dbeaf4] text-[#3b82a4]">
                    <SearchSlash className="size-6" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-slate-900">
                    {copy.nothingToRead}
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">
                    {copy.nothingToReadText}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {copy.editor}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  {selectedArticle ? copy.editArticle : copy.newNote}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{copy.editorText}</p>
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
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
