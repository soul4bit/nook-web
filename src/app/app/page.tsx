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
  workspace: "Workspace",
  workspaceText:
    "\u0422\u0438\u0445\u0430\u044f \u0431\u0430\u0437\u0430 \u0437\u043d\u0430\u043d\u0438\u0439 \u043f\u043e Linux, Docker, \u0441\u0435\u0442\u044f\u043c, Ansible, Kubernetes, Terraform \u0438 CI/CD. \u0421\u043b\u0435\u0432\u0430 \u0440\u0430\u0437\u0434\u0435\u043b\u044b, \u0432\u043d\u0443\u0442\u0440\u0438 \u0441\u0442\u0430\u0442\u044c\u0438, \u0441\u043f\u0440\u0430\u0432\u0430 \u0447\u0442\u0435\u043d\u0438\u0435 \u0438 \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440.",
  newArticle: "\u041d\u043e\u0432\u0430\u044f \u0441\u0442\u0430\u0442\u044c\u044f",
  account: "\u041b\u0438\u0447\u043d\u044b\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442",
  sections: "\u0420\u0430\u0437\u0434\u0435\u043b\u044b",
  articlesSuffix: "\u0441\u0442\u0430\u0442\u0435\u0439",
  noArticlesInSection:
    "\u0412 \u044d\u0442\u043e\u043c \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u0442\u0430\u0442\u0435\u0439. \u0421\u043e\u0437\u0434\u0430\u0439 \u043f\u0435\u0440\u0432\u0443\u044e \u0437\u0430\u043c\u0435\u0442\u043a\u0443 \u0432 \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440\u0435 \u0441\u043f\u0440\u0430\u0432\u0430.",
  currentSection: "\u0421\u0435\u0439\u0447\u0430\u0441 \u043e\u0442\u043a\u0440\u044b\u0442 \u0440\u0430\u0437\u0434\u0435\u043b",
  sectionCount: "\u0441\u0442\u0430\u0442\u0435\u0439 \u0432 \u0440\u0430\u0437\u0434\u0435\u043b\u0435",
  heroTitle:
    "Контур Знаний хранит заметки так, чтобы их было удобно перечитывать.",
  heroText:
    "\u041e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u0448\u044c \u0440\u0430\u0437\u0434\u0435\u043b, \u0432\u0438\u0434\u0438\u0448\u044c \u0441\u043f\u0438\u0441\u043e\u043a \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u043e\u0432 \u043f\u043e \u0442\u0435\u043c\u0435, \u0432\u044b\u0431\u0438\u0440\u0430\u0435\u0448\u044c \u0441\u0442\u0430\u0442\u044c\u044e \u0438 \u0441\u0440\u0430\u0437\u0443 \u0447\u0438\u0442\u0430\u0435\u0448\u044c \u0435\u0435 \u0440\u044f\u0434\u043e\u043c. \u042d\u0442\u043e \u043b\u0438\u0447\u043d\u0430\u044f \u0442\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u0431\u0430\u0437\u0430, \u043a \u043a\u043e\u0442\u043e\u0440\u043e\u0439 \u0443\u0434\u043e\u0431\u043d\u043e \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0442\u044c\u0441\u044f.",
  snapshot: "\u0421\u0440\u0435\u0437",
  allArticles: "\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u044c\u0438",
  lastUpdate: "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435",
  emptyValue: "\u041f\u043e\u043a\u0430 \u043f\u0443\u0441\u0442\u043e",
  updated: "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e",
  created: "\u0421\u043e\u0437\u0434\u0430\u043d\u043e",
  author: "\u0410\u0432\u0442\u043e\u0440",
  lastEditor: "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440",
  reading: "\u0427\u0442\u0435\u043d\u0438\u0435 \u0441\u0442\u0430\u0442\u044c\u0438",
  nothingToRead: "\u0412 \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0447\u0435\u0433\u043e \u0447\u0438\u0442\u0430\u0442\u044c",
  nothingToReadText:
    "\u0412\u044b\u0431\u0435\u0440\u0438 \u0434\u0440\u0443\u0433\u043e\u0439 \u0440\u0430\u0437\u0434\u0435\u043b \u0441\u043e \u0441\u0442\u0430\u0442\u044c\u044f\u043c\u0438 \u0438\u043b\u0438 \u0441\u043e\u0437\u0434\u0430\u0439 \u043f\u0435\u0440\u0432\u0443\u044e \u0437\u0430\u043c\u0435\u0442\u043a\u0443 \u043f\u043e \u044d\u0442\u043e\u0439 \u0442\u0435\u043c\u0435 \u0432 \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440\u0435.",
  editor: "\u0420\u0435\u0434\u0430\u043a\u0442\u043e\u0440",
  editArticle: "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0441\u0442\u0430\u0442\u044c\u0438",
  newNote: "\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430",
  editorText:
    "\u0421\u043e\u0437\u0434\u0430\u0439 \u0441\u0442\u0430\u0442\u044c\u044e \u0432 \u043d\u0443\u0436\u043d\u043e\u043c \u0440\u0430\u0437\u0434\u0435\u043b\u0435, \u0441\u043e\u0445\u0440\u0430\u043d\u0438 \u0435\u0435 \u0432 PostgreSQL \u0438 \u043e\u043d\u0430 \u0441\u0440\u0430\u0437\u0443 \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u0441\u043b\u0435\u0432\u0430 \u0432 \u0441\u043f\u0438\u0441\u043a\u0435.",
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
  const requestedTopic = params?.topic && isArticleTopic(params.topic) ? params.topic : null;
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
  const selectedArticleSummary =
    draftMode
      ? null
      : requestedArticle && requestedArticle.topic === selectedTopic
        ? requestedArticle
        : categoryArticles[0] ?? null;
  const selectedArticle =
    selectedArticleSummary && (!requestedArticle || requestedArticle.id !== selectedArticleSummary.id)
      ? await getArticleById(session.user.id, selectedArticleSummary.id)
      : draftMode
        ? null
        : requestedArticle;

  const displayName = session.user.name?.trim() || session.user.email;
  const totalArticles = articles.length;

  return (
    <div className="min-h-screen bg-[#121514] px-4 py-4 text-[#f3f7f4] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1600px] flex-col overflow-hidden rounded-[36px] border border-[#29312d] bg-[radial-gradient(circle_at_top_left,rgba(83,230,166,0.18),transparent_26%),linear-gradient(180deg,#181c1a_0%,#111413_100%)] shadow-[0_30px_120px_rgba(0,0,0,0.45)] lg:flex-row">
        <aside className="flex w-full flex-col border-b border-[#29312d] bg-[#141816]/95 p-5 lg:max-w-[320px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-16 items-center justify-center overflow-hidden rounded-[18px] border border-[#31413a] bg-[#0f1311]">
                <div className="absolute left-2 h-3 w-2 rounded-full bg-[#53e6a6]" />
                <div className="absolute left-5 top-3 h-6 w-4 rounded-l-[18px] rounded-r-[6px] bg-[#53e6a6]" />
                <div className="absolute left-7 top-2 h-8 w-3 rotate-[32deg] rounded-full bg-[#53e6a6]" />
                <div className="absolute right-5 top-3 h-6 w-4 rounded-l-[6px] rounded-r-[18px] bg-[#53e6a6]" />
                <div className="absolute right-2 h-3 w-2 rounded-full bg-[#53e6a6]" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-[#6d8379]">
                  Контур Знаний
                </p>
                <p className="text-sm text-[#d7e2dc]">DevOps knowledge base</p>
              </div>
            </div>

            <SignOutButton className="border-[#2b3531] bg-[#181e1b] text-[#dce7e1] hover:bg-[#1c2320]" />
          </div>

          <div className="mt-8 rounded-[28px] border border-[#29312d] bg-[#171c19] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#6d8379]">
              {copy.workspace}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <UserAvatar image={session.user.image} name={displayName} />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-white">
                  {displayName}
                </h1>
                <p className="mt-1 truncate text-sm text-[#8fa59c]">{session.user.email}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-[#90a69d]">{copy.workspaceText}</p>

            <div className="mt-5 grid gap-3">
              <Button
                asChild
                className="h-11 w-full rounded-2xl bg-[#53e6a6] text-[#0c1511] hover:bg-[#47cf95]"
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
                className="h-11 w-full rounded-2xl border-[#2b3531] bg-[#111513] text-white hover:bg-[#1a201d]"
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
              <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-[#6d8379]">
                {copy.sections}
              </p>
              <span className="rounded-full border border-[#2b3531] px-2.5 py-1 text-xs text-[#a4bab1]">
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
                    className={`rounded-[24px] border transition-colors ${
                      isActive
                        ? "border-[#53e6a6]/30 bg-[#1c2622]"
                        : "border-[#29312d] bg-[#171c19]"
                    }`}
                  >
                    <Link
                      href={buildAppHref(topic.name)}
                      className="flex items-start gap-3 px-4 py-4"
                    >
                      <div
                        className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl ${
                          isActive
                            ? "bg-[#53e6a6] text-[#09120e]"
                            : "bg-[#111513] text-[#8ba198]"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-white">{topic.name}</h2>
                          <span className="text-xs text-[#7f948b]">{nestedArticles.length}</span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[#8fa59c]">
                          {topic.summary}
                        </p>
                      </div>
                    </Link>

                    {isActive ? (
                      <div className="border-t border-[#29312d] px-3 py-3">
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
                                    className={`flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] transition-colors ${
                                      isCategoryActive
                                        ? "bg-[#202b26] text-[#53e6a6]"
                                        : "bg-[#151917] text-[#7f948b] hover:bg-[#1a1f1d]"
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
                                            className={`block rounded-2xl px-3 py-3 transition-colors ${
                                              isSelected
                                                ? "bg-[#53e6a6] text-[#0b1510]"
                                                : "bg-[#111513] text-[#dce6e0] hover:bg-[#1a201d]"
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">
                                                  {article.title}
                                                </p>
                                                <p
                                                  className={`mt-1 line-clamp-2 text-xs leading-5 ${
                                                    isSelected
                                                      ? "text-[#183226]"
                                                      : "text-[#88a096]"
                                                  }`}
                                                >
                                                  {article.summary}
                                                </p>
                                              </div>
                                              <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" />
                                            </div>
                                          </Link>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="rounded-2xl border border-dashed border-[#314039] px-3 py-3 text-sm leading-6 text-[#7e948a]">
                                      В этой категории пока нет статей.
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[#314039] px-3 py-4 text-sm leading-6 text-[#7e948a]">
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

        <main className="flex min-w-0 flex-1 flex-col gap-6 p-5 lg:p-6">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-[32px] border border-[#29312d] bg-[#171c19] p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#6d8379]">
                {copy.currentSection}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full bg-[#53e6a6] px-3 py-1 text-sm font-medium text-[#0a1410]">
                  {currentTopic.name}
                </span>
                <span className="inline-flex rounded-full border border-[#2d3934] px-3 py-1 text-sm font-medium text-[#dce6e0]">
                  {selectedCategory}
                </span>
                <span className="text-sm text-[#8fa59c]">
                  {categoryArticles.length} {copy.sectionCount}
                </span>
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-[2.5rem]">
                {copy.heroTitle}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#8fa59c] sm:text-base">
                {copy.heroText}
              </p>
            </div>

            <div className="rounded-[32px] border border-[#29312d] bg-[#171c19] p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#6d8379]">
                {copy.snapshot}
              </p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-[24px] border border-[#29312d] bg-[#111513] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#6d8379]">
                    {copy.allArticles}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">{totalArticles}</p>
                </div>
                <div className="rounded-[24px] border border-[#29312d] bg-[#111513] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#6d8379]">
                    Категория
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">{selectedCategory}</p>
                </div>
                <div className="rounded-[24px] border border-[#29312d] bg-[#111513] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#6d8379]">
                    {copy.lastUpdate}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {articles[0] ? formatDateTime(articles[0].updatedAt) : copy.emptyValue}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-[32px] border border-[#29312d] bg-[#171c19] p-6">
              {selectedArticle ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex rounded-full bg-[#53e6a6] px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[#0a1410]">
                      {selectedArticle.topic}
                    </span>
                    <span className="inline-flex rounded-full border border-[#2d3934] px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[#dce6e0]">
                      {selectedArticle.category}
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs text-[#7f948b]">
                      <Clock3 className="size-3.5" />
                      {copy.updated} {formatDateTime(selectedArticle.updatedAt)}
                    </span>
                  </div>

                  <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                    {selectedArticle.title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[#8fa59c] sm:text-base">
                    {selectedArticle.summary}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-[#29312d] bg-[#111513] px-4 py-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#6d8379]">
                        <UserRound className="size-3.5" />
                        {copy.author}
                      </div>
                      <p className="mt-2 text-sm font-medium text-white">
                        {selectedArticle.authorName}
                      </p>
                      <p className="mt-1 text-xs text-[#7f948b]">
                        {copy.created} {formatDateTime(selectedArticle.createdAt)}
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-[#29312d] bg-[#111513] px-4 py-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#6d8379]">
                        <PenSquare className="size-3.5" />
                        {copy.lastEditor}
                      </div>
                      <p className="mt-2 text-sm font-medium text-white">
                        {selectedArticle.updatedByName}
                      </p>
                      <p className="mt-1 text-xs text-[#7f948b]">
                        {copy.updated} {formatDateTime(selectedArticle.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[28px] border border-[#29312d] bg-[#111513] p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-[#b8c9c1]">
                      <BookOpenText className="size-4 text-[#53e6a6]" />
                      {copy.reading}
                    </div>
                    <article
                      className="nook-editor max-w-none space-y-4 text-sm leading-7 text-[#d9e4de]"
                      dangerouslySetInnerHTML={{ __html: selectedArticle.contentHtml }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#314039] bg-[#111513] px-8 text-center">
                  <div className="flex size-14 items-center justify-center rounded-3xl bg-[#1c2622] text-[#53e6a6]">
                    <SearchSlash className="size-6" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-white">
                    {copy.nothingToRead}
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-7 text-[#8fa59c]">
                    {copy.nothingToReadText}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[32px] border border-[#29312d] bg-[#171c19] p-6">
              <div className="mb-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#6d8379]">
                  {copy.editor}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  {selectedArticle ? copy.editArticle : copy.newNote}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#8fa59c]">{copy.editorText}</p>
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
