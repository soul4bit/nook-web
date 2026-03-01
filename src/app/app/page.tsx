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
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { ThoughtEditor } from "@/components/editor/thought-editor";
import { ArticleContent } from "@/components/articles/article-content";
import { UserAvatar } from "@/components/user/user-avatar";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getArticleById,
  isArticleTopic,
  listArticlesByAuthor,
  searchArticlesByAuthor,
} from "@/lib/articles/server";
import { articleTopics } from "@/lib/content/devops-library";

const copy = {
  workspace: "Р›РёС‡РЅРѕРµ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРѕ",
  workspaceText:
    "Р’СЃСЏ Р±Р°Р·Р° РїРѕ Linux, Docker, СЃРµС‚СЏРј, Ansible, Kubernetes, Terraform Рё CI/CD РІ РѕРґРЅРѕРј РёРЅС‚РµСЂС„РµР№СЃРµ: СЃР»РµРІР° СЂР°Р·РґРµР»С‹ Рё СЃС‚Р°С‚СЊРё, СЃРїСЂР°РІР° С‡С‚РµРЅРёРµ Рё СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ.",
  newArticle: "РќРѕРІР°СЏ СЃС‚Р°С‚СЊСЏ",
  account: "Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚",
  sections: "Р Р°Р·РґРµР»С‹",
  articlesSuffix: "СЃС‚Р°С‚РµР№",
  noArticlesInSection:
    "Р’ СЌС‚РѕРј СЂР°Р·РґРµР»Рµ РїРѕРєР° РЅРµС‚ СЃС‚Р°С‚РµР№. РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІСѓСЋ Р·Р°РјРµС‚РєСѓ С‡РµСЂРµР· СЂРµРґР°РєС‚РѕСЂ СЃРїСЂР°РІР°.",
  currentSection: "РўРµРєСѓС‰РёР№ СЂР°Р·РґРµР»",
  sectionCount: "СЃС‚Р°С‚РµР№ РІ РєР°С‚РµРіРѕСЂРёРё",
  heroTitle: "Р‘Р°Р·Р° Р·РЅР°РЅРёР№, РІ РєРѕС‚РѕСЂРѕР№ Р»РµРіРєРѕ РЅР°Р№С‚Рё РЅСѓР¶РЅС‹Р№ РѕС‚РІРµС‚.",
  heroText:
    "РћС‚РєСЂРѕР№С‚Рµ С‚РµРјСѓ, РІС‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ Рё С‡РёС‚Р°Р№С‚Рµ СЃС‚Р°С‚СЊСЋ СЂСЏРґРѕРј СЃ СЂРµРґР°РєС‚РѕСЂРѕРј. РњРѕР¶РЅРѕ Р±С‹СЃС‚СЂРѕ РѕР±РЅРѕРІР»СЏС‚СЊ РјР°С‚РµСЂРёР°Р» Рё СЃСЂР°Р·Сѓ РІРёРґРµС‚СЊ РёС‚РѕРіРѕРІС‹Р№ С‚РµРєСЃС‚.",
  snapshot: "РЎРІРѕРґРєР°",
  allArticles: "Р’СЃРµРіРѕ СЃС‚Р°С‚РµР№",
  lastUpdate: "РџРѕСЃР»РµРґРЅРµРµ РѕР±РЅРѕРІР»РµРЅРёРµ",
  emptyValue: "РџРѕРєР° РЅРµС‚ РґР°РЅРЅС‹С…",
  updated: "РћР±РЅРѕРІР»РµРЅРѕ",
  created: "РЎРѕР·РґР°РЅРѕ",
  author: "РђРІС‚РѕСЂ",
  lastEditor: "РџРѕСЃР»РµРґРЅРёР№ СЂРµРґР°РєС‚РѕСЂ",
  reading: "Р§С‚РµРЅРёРµ СЃС‚Р°С‚СЊРё",
  nothingToRead: "РџРѕРєР° РЅРµС‡РµРіРѕ С‡РёС‚Р°С‚СЊ",
  nothingToReadText:
    "Р’С‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ СЃРѕ СЃС‚Р°С‚СЊСЏРјРё РёР»Рё СЃРѕР·РґР°Р№С‚Рµ РЅРѕРІСѓСЋ Р·Р°РјРµС‚РєСѓ. РљР°Рє С‚РѕР»СЊРєРѕ СЃРѕС…СЂР°РЅРёС‚Рµ РјР°С‚РµСЂРёР°Р», РѕРЅ СЃСЂР°Р·Сѓ РїРѕСЏРІРёС‚СЃСЏ РІ СЃРїРёСЃРєРµ.",
  editor: "Р РµРґР°РєС‚РѕСЂ",
  editArticle: "Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ СЃС‚Р°С‚СЊРё",
  newNote: "РќРѕРІР°СЏ Р·Р°РјРµС‚РєР°",
  editorText:
    "РЎРѕС…СЂР°РЅРµРЅРёРµ РёРґРµС‚ РІ PostgreSQL РІ С„РѕСЂРјР°С‚Рµ markdown + html. РџРѕСЃР»Рµ СЃРѕС…СЂР°РЅРµРЅРёСЏ РјР°С‚РµСЂРёР°Р» СЃСЂР°Р·Сѓ РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ РІ СЃРїРёСЃРєРµ РєР°С‚РµРіРѕСЂРёРё.",
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
  const allArticles = await listArticlesByAuthor(session.user.id);
  const articles = searchQuery
    ? await searchArticlesByAuthor(session.user.id, searchQuery)
    : allArticles;
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
          ...allArticles
            .filter((article) => article.topic === topic.name)
            .map((article) => article.category),
          "РћР±С‰РµРµ",
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
    "РћР±С‰РµРµ";
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
  const totalArticles = allArticles.length;
  const visibleArticlesCount = articles.length;
  const hasSearchQuery = Boolean(searchQuery);
  const wikiLinks = allArticles.map((article) => ({
    slug: article.slug,
    title: article.title,
    href: buildAppHref(article.topic, {
      articleId: article.id,
      category: article.category,
    }),
  }));

  return (
    <div className="min-h-screen px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1640px] flex-col overflow-hidden rounded-[32px] border border-slate-300 bg-[#e9edf3]/96 shadow-[0_30px_90px_rgba(15,23,42,0.12)] lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-slate-300 bg-[#dde5ee] p-5 lg:max-w-[340px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <KnowledgeLogo subtitle="Личная DevOps-вики" />

            <SignOutButton />
          </div>

          <div className="mt-7 rounded-[24px] border border-slate-300 bg-[#f3f6fa] p-4">
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
                className="h-11 w-full rounded-2xl border-slate-200 bg-[#f8fafc] text-slate-800 hover:bg-slate-100"
              >
                <Link href="/app/account">
                  <UserRoundCog className="size-4" />
                  {copy.account}
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-slate-300 bg-[#edf2f7] p-3">
            <form action="/app" method="get" className="space-y-2">
              <input type="hidden" name="topic" value={selectedTopic} />
              <input type="hidden" name="category" value={selectedCategory} />
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  name="q"
                  defaultValue={searchQuery}
                  placeholder={copy.searchPlaceholder}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-[#3b82a4] focus-visible:outline-none"
                />
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-[#3b82a4] px-3 text-sm font-semibold text-white hover:bg-[#327391]"
                >
                  {copy.searchButton}
                </button>
              </div>
            </form>
            {hasSearchQuery ? (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  {copy.searchResult}: {visibleArticlesCount}
                </p>
                <Link
                  href={buildAppHref(selectedTopic, {
                    category: selectedCategory,
                  })}
                  className="text-xs font-semibold text-[#2d6782] hover:underline"
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
              <span className="rounded-full border border-slate-300 bg-[#eef3f7] px-2.5 py-1 text-xs text-slate-600">
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
                        ? "border-[#b7d0df] bg-[#eaf4fb]"
                        : "border-slate-200 bg-white"
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
                                      query: searchQuery || undefined,
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
                                              query: searchQuery || undefined,
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
                                      Р’ СЌС‚РѕР№ РєР°С‚РµРіРѕСЂРёРё РїРѕРєР° РЅРµС‚ СЃС‚Р°С‚РµР№.
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
            <div className="rounded-[28px] border border-slate-300 bg-[#f3f6fa] p-6">
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

            <div className="rounded-[28px] border border-slate-300 bg-[#f3f6fa] p-6">
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
                    РљР°С‚РµРіРѕСЂРёСЏ
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
            <div className="rounded-[28px] border border-slate-300 bg-[#f3f6fa] p-6">
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
                    <ArticleContent
                      html={selectedArticle.contentHtml}
                      wikiLinks={wikiLinks}
                      className="max-w-none space-y-4 text-sm leading-7 text-slate-700"
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

            <div className="rounded-[28px] border border-slate-300 bg-[#f3f6fa] p-6">
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


