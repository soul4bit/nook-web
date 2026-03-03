import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Boxes,
  Cable,
  FolderKanban,
  HardDriveUpload,
  Plus,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { WorkspacePanels } from "@/components/app/workspace-panels";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { UserAvatar } from "@/components/user/user-avatar";
import { Button } from "@/components/ui/button";
import { getCurrentSession, isAdminSession } from "@/lib/auth/session";
import {
  getArticleById,
  isArticleTopic,
  listArticles,
  searchArticles,
} from "@/lib/articles/server";
import { articleTopics, type ArticleTopic } from "@/lib/content/devops-library";
import { getUserArticleWriteAccess } from "@/lib/auth/article-permissions";

const copy = {
  newArticle: "Новая заметка",
  admin: "Админ-панель",
  sections: "Разделы",
  articlesSuffix: "статей",
  noArticlesInSection:
    "В этой категории пока нет материалов. Создайте первую заметку через редактор справа.",
  searchPlaceholder: "Поиск по заголовку, описанию и тексту",
  searchButton: "Найти",
  clearSearch: "Сброс",
  searchResult: "Результаты поиска",
} as const;

const topicIcons = {
  Linux: ServerCog,
  Docker: Boxes,
  "Сети": Cable,
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
    edit?: string;
    q?: string;
  }>;
};

function buildAppHref(
  topic: string,
  options?: {
    articleId?: string;
    draft?: boolean;
    edit?: boolean;
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

  if (options?.edit) {
    params.set("edit", "1");
  }

  if (options?.query?.trim()) {
    params.set("q", options.query.trim());
  }

  return `/app?${params.toString()}`;
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
  const editModeRequested = params?.edit === "1";
  const searchQuery = params?.q?.trim().slice(0, 180) ?? "";
  const allArticles = await listArticles();
  const articles = searchQuery ? await searchArticles(searchQuery) : allArticles;
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
  ) as Record<ArticleTopic, string[]>;
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
  const isEditMode = Boolean(selectedArticle && editModeRequested);
  const selectedArticleHref = selectedArticle
    ? buildAppHref(selectedArticle.topic, {
        articleId: selectedArticle.id,
        category: selectedArticle.category,
        query: searchQuery || undefined,
      })
    : null;
  const editArticleHref = selectedArticle
    ? buildAppHref(selectedArticle.topic, {
        articleId: selectedArticle.id,
        category: selectedArticle.category,
        query: searchQuery || undefined,
        edit: true,
      })
    : null;

  const displayName = session.user.name?.trim() || session.user.email;
  const isAdmin = isAdminSession(session);
  const canManageArticles = await getUserArticleWriteAccess(
    session.user.id,
    (session.user as { role?: unknown }).role
  );
  const totalArticles = allArticles.length;
  const visibleArticlesCount = articles.length;
  const lastUpdatedAt = articles[0]?.updatedAt ?? null;
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
    <div className="min-h-screen bg-transparent text-slate-100">
      <header className="sticky top-0 z-30 border-b border-[#2a4156] bg-[#0f1f30]/92 shadow-[0_1px_0_rgba(71,103,128,0.35)] backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
          <Link href={buildAppHref(selectedTopic, { category: selectedCategory })}>
            <KnowledgeLogo
              subtitle="Командная база знаний"
              titleClassName="text-[#dce8f2]"
              subtitleClassName="text-[#8ea9bd]"
              markClassName="border-[#3a5469] bg-[#14293b] shadow-none"
            />
          </Link>

          <form
            action="/app"
            method="get"
            className="order-3 flex w-full items-center gap-2 md:order-none md:flex-1"
          >
            <input type="hidden" name="topic" value={selectedTopic} />
            <input type="hidden" name="category" value={selectedCategory} />
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#88a7bc]" />
              <input
                type="search"
                name="q"
                defaultValue={searchQuery}
                placeholder={copy.searchPlaceholder}
                className="h-10 w-full rounded-xl border border-[#35526a] bg-[#12283a] pl-9 pr-3 text-sm text-[#d5e6f3] placeholder:text-[#7f9db4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 sm:h-11"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-xl bg-[#0f7aaf] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0d6997] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 sm:h-11"
            >
              {copy.searchButton}
            </button>
            {hasSearchQuery ? (
              <Link
                href={buildAppHref(selectedTopic, { category: selectedCategory })}
                className="hidden text-sm font-semibold text-[#8ed9f5] hover:text-[#b8edff] hover:underline md:inline"
              >
                {copy.clearSearch}
              </Link>
            ) : null}
          </form>

          <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto sm:justify-start">
            {canManageArticles ? (
              <Button asChild size="sm" className="h-9 rounded-lg bg-sky-600 hover:bg-sky-700">
                <Link
                  href={buildAppHref(selectedTopic, {
                    draft: true,
                    category: selectedCategory,
                    query: searchQuery || undefined,
                  })}
                >
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">{copy.newArticle}</span>
                </Link>
              </Button>
            ) : null}

            {isAdmin ? (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="hidden h-9 rounded-lg border-[#3a556c] bg-[#152a3d] text-[#c9dcea] hover:bg-[#1a3247] md:inline-flex"
              >
                <Link href="/app/admin">
                  <ShieldCheck className="size-4" />
                  {copy.admin}
                </Link>
              </Button>
            ) : null}

            <SignOutButton className="h-9 rounded-lg border-[#3a556c] bg-[#152a3d] px-2.5 text-[#c9dcea] hover:bg-[#1a3247] sm:px-3" />

            <Link
              href="/app/account"
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              aria-label="Личный кабинет"
            >
              <UserAvatar
                image={session.user.image}
                name={displayName}
                className="size-9 rounded-lg border border-[#3a556c] bg-[#152a3d]"
                fallbackClassName="text-[#8fd4f0]"
              />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1700px] gap-4 px-3 py-3 sm:gap-5 sm:px-6 sm:py-4 lg:grid-cols-[300px_minmax(0,1fr)_430px] lg:px-8">
        <aside className="order-2 space-y-3 sm:space-y-4 lg:order-1">
          <section className="nook-surface rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8ea9bd]">
                {copy.sections}
              </p>
              <span className="rounded-full bg-[#182e41] px-2 py-1 text-xs text-[#a9c0d1]">
                {hasSearchQuery ? `${visibleArticlesCount}/${totalArticles}` : totalArticles} {" "}
                {copy.articlesSuffix}
              </span>
            </div>
            {hasSearchQuery ? (
              <div className="rounded-xl border border-[#3b6f8f] bg-[#142d41] px-3 py-2 text-xs text-[#9ccbe3]">
                {copy.searchResult}: {visibleArticlesCount}
              </div>
            ) : null}
          </section>

          <nav className="space-y-2 sm:space-y-3">
            {articleTopics.map((topic) => {
              const Icon = topicIcons[topic.name];
              const isActive = topic.name === selectedTopic;
              const nestedArticles = articles.filter((article) => article.topic === topic.name);
              const nestedCategories = Array.from(
                new Set([...topic.categories, ...nestedArticles.map((article) => article.category)])
              );

              return (
                <article
                  key={topic.name}
                  className={`nook-surface rounded-2xl transition-[border-color,box-shadow] ${
                    isActive
                      ? "border-sky-300/90"
                      : "border-[#2f4a61] hover:border-[#3f637f] hover:shadow-[0_12px_26px_rgba(2,8,16,0.35)]"
                  }`}
                >
                  <Link
                    href={buildAppHref(topic.name, {
                      query: searchQuery || undefined,
                    })}
                    className="flex items-start gap-3 px-4 py-3.5"
                  >
                    <div
                      className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        isActive ? "bg-[#163c58] text-[#8fd3ee]" : "bg-[#182c3d] text-[#99b1c2]"
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-[#e4eef6]">{topic.name}</h2>
                        <span className="text-xs text-[#8ea9bd]">{nestedArticles.length}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#9cb2c3]">{topic.summary}</p>
                    </div>
                  </Link>

                  {isActive ? (
                    <div className="border-t border-[#2d455a] px-3 py-3">
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
                                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                                    isCategoryActive
                                      ? "border-[#57c3e7] bg-[#173550] text-[#d8effb]"
                                      : "border-transparent bg-[#182d3f] text-[#a2b9ca] hover:border-[#3d5d78] hover:bg-[#1b3247]"
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
                                          className={`block rounded-xl border px-3 py-3 transition-all ${
                                            isSelected
                                              ? "border-[#62cdef] bg-[#16354f] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.28)]"
                                              : "border-[#2f4a61] bg-[#102031] hover:border-[#3e637f] hover:bg-[#172c40]"
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-semibold text-[#e4eef6]">
                                                {article.title}
                                              </p>
                                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#9cb2c3]">
                                                {article.summary}
                                              </p>
                                            </div>
                                            <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-[#88a7bc]" />
                                          </div>
                                        </Link>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-[#3a566f] bg-[#13283a] px-3 py-3 text-xs leading-5 text-[#97b0c2]">
                                    В этой категории пока нет статей.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#3a566f] bg-[#13283a] px-3 py-3 text-xs leading-5 text-[#97b0c2]">
                          {copy.noArticlesInSection}
                        </div>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </nav>
        </aside>

        <WorkspacePanels
          selectedArticle={selectedArticle}
          selectedTopic={selectedTopic}
          selectedCategory={selectedCategory}
          topics={articleTopics.map((topic) => topic.name)}
          topicCategories={topicCategoryMap}
          totalArticles={totalArticles}
          lastUpdatedAt={lastUpdatedAt}
          isAdmin={isAdmin}
          currentUserId={session.user.id}
          canManageArticles={canManageArticles}
          isEditMode={isEditMode}
          editArticleHref={editArticleHref}
          closeEditorHref={selectedArticleHref}
          wikiLinks={wikiLinks}
        />
      </div>
    </div>
  );
}
