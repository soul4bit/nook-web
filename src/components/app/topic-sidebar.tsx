import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  Cable,
  FolderKanban,
  HardDriveUpload,
  ServerCog,
  Sparkles,
} from "lucide-react";
import { type ArticleListItem } from "@/lib/articles/server";
import { buildAppHref } from "@/lib/app/build-app-href";
import { articleTopics, type ArticleTopic } from "@/lib/content/devops-library";

type TopicSidebarProps = {
  allArticles: ArticleListItem[];
  visibleArticles: ArticleListItem[];
  selectedTopic: ArticleTopic;
  selectedCategory: string;
  selectedArticleId: string | null;
  searchQuery: string;
};

const topicIcons = {
  Linux: ServerCog,
  Docker: Boxes,
  Сети: Cable,
  Ansible: FolderKanban,
  K8S: HardDriveUpload,
  Terraform: FolderKanban,
  "CI/CD": Sparkles,
} as const;

export function TopicSidebar({
  allArticles,
  visibleArticles,
  selectedTopic,
  selectedCategory,
  selectedArticleId,
  searchQuery,
}: TopicSidebarProps) {
  const totalArticles = allArticles.length;
  const hasSearchQuery = Boolean(searchQuery);

  return (
    <aside className="order-2 space-y-4 lg:order-1">
      <section className="nook-panel rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Разделы</p>
          <span className="rounded-full border-2 border-border px-2.5 py-1 text-xs font-medium text-foreground">
            {hasSearchQuery ? `${visibleArticles.length}/${totalArticles}` : totalArticles} статей
          </span>
        </div>
        {hasSearchQuery ? (
          <p className="mt-3 rounded-lg bg-muted/80 px-3 py-2 text-xs text-muted-foreground">
            Нашли: {visibleArticles.length}
          </p>
        ) : null}
      </section>

      <nav className="space-y-3">
        {articleTopics.map((topic) => {
          const Icon = topicIcons[topic.name];
          const isActive = topic.name === selectedTopic;
          const topicArticles = visibleArticles.filter((article) => article.topic === topic.name);
          const topicArticlesFromAll = allArticles.filter((article) => article.topic === topic.name);
          const categoryList = Array.from(
            new Set([...topic.categories, ...topicArticlesFromAll.map((article) => article.category)])
          );

          return (
            <article
              key={topic.name}
              className={`nook-panel rounded-2xl transition-transform ${
                isActive ? "border-primary/80" : "hover:-translate-y-px"
              }`}
            >
              <Link
                href={buildAppHref(topic.name, { query: searchQuery || undefined })}
                className="flex items-start gap-3 px-4 py-3.5"
              >
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-border ${
                    isActive ? "bg-primary/20 text-primary" : "bg-white text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">{topic.name}</h2>
                    <span className="text-xs text-muted-foreground">{topicArticles.length}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{topic.summary}</p>
                </div>
              </Link>

              {isActive ? (
                <div className="space-y-4 border-t-2 border-border/70 px-3 py-3">
                  {categoryList.map((categoryName) => {
                    const groupedArticles = topicArticles.filter((article) => article.category === categoryName);
                    const isCategoryActive = categoryName === selectedCategory;

                    return (
                      <div key={categoryName} className="space-y-2">
                        <Link
                          href={buildAppHref(topic.name, {
                            category: categoryName,
                            query: searchQuery || undefined,
                          })}
                          className={`flex items-center justify-between rounded-lg border-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
                            isCategoryActive
                              ? "border-primary/80 bg-primary/10 text-foreground"
                              : "border-border bg-white text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <span>{categoryName}</span>
                          <span>{groupedArticles.length}</span>
                        </Link>

                        {groupedArticles.length > 0 ? (
                          <div className="space-y-2">
                            {groupedArticles.map((article) => {
                              const isSelected = article.id === selectedArticleId;

                              return (
                                <Link
                                  key={article.id}
                                  href={buildAppHref(topic.name, {
                                    articleId: article.id,
                                    category: categoryName,
                                    query: searchQuery || undefined,
                                  })}
                                  className={`block rounded-lg border-2 px-3 py-2.5 ${
                                    isSelected
                                      ? "border-primary/80 bg-primary/10"
                                      : "border-border bg-card hover:border-primary/50"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-foreground">
                                        {article.title}
                                      </p>
                                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                        {article.summary}
                                      </p>
                                    </div>
                                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="rounded-lg border-2 border-dashed border-border bg-muted/35 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                            Пока пусто. Можно стать первым героем этой категории.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
          );
        })}
      </nav>
    </aside>
  );
}
