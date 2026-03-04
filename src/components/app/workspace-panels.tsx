"use client";

import Link from "next/link";
import {
  BookOpenText,
  Clock3,
  Edit3,
  FileText,
  Network,
  PenSquare,
  UserRound,
} from "lucide-react";
import { ArticleContent } from "@/components/articles/article-content";
import { ThoughtEditor } from "@/components/editor/thought-editor";
import { type ArticleListItem } from "@/lib/articles/server";
import { buildAppHref } from "@/lib/app/build-app-href";
import { type ArticleTopic } from "@/lib/content/devops-library";

const copy = {
  snapshot: "Сводка",
  allArticles: "Всего статей",
  lastUpdate: "Последнее обновление",
  emptyValue: "пока нет данных",
  updated: "Обновлено",
  created: "Создано",
  author: "Автор",
  lastEditor: "Последний редактор",
  reading: "Чтение",
  editor: "Редактор",
  editArticle: "Редактирование узла",
  newNote: "Новый узел",
  editorText: "Соберите понятный узел атласа: контекст, шаги и итоговое решение.",
  editButton: "Редактировать",
  closeEditor: "Вернуться к узлу",
  noAccessEmptyTitle: "Здесь пока пусто",
  noAccessEmptyText: "Выберите категорию или создайте первый узел в текущем разделе.",
  sectionLabel: "Раздел",
  categoryLabel: "Категория",
  atlasTitle: "Карта раздела",
  atlasText: "Центр: раздел. Орбита: категории. Правая колонка: узлы выбранной категории.",
  focusNodes: "Узлы категории",
} as const;

type EditorArticle = Parameters<typeof ThoughtEditor>[0]["article"];
type EditorTopics = Parameters<typeof ThoughtEditor>[0]["topics"];
type EditorTopicCategories = Parameters<typeof ThoughtEditor>[0]["topicCategories"];
type WikiLink = Parameters<typeof ThoughtEditor>[0]["wikiLinks"][number];

type WorkspacePanelsProps = {
  selectedArticle: EditorArticle;
  selectedTopic: ArticleTopic;
  selectedCategory: string;
  topics: EditorTopics;
  topicCategories: EditorTopicCategories;
  totalArticles: number;
  lastUpdatedAt: string | null;
  isAdmin: boolean;
  currentUserId: string;
  canManageArticles: boolean;
  isEditMode: boolean;
  editArticleHref: string | null;
  closeEditorHref: string | null;
  wikiLinks: WikiLink[];
  visibleArticles: ArticleListItem[];
  searchQuery: string;
};

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function WorkspacePanels({
  selectedArticle,
  selectedTopic,
  selectedCategory,
  topics,
  topicCategories,
  totalArticles,
  lastUpdatedAt,
  isAdmin,
  currentUserId,
  canManageArticles,
  isEditMode,
  editArticleHref,
  closeEditorHref,
  wikiLinks,
  visibleArticles,
  searchQuery,
}: WorkspacePanelsProps) {
  const canEditSelectedArticle = Boolean(
    selectedArticle && canManageArticles && (!selectedArticle.authorIsAdmin || isAdmin)
  );
  const canDeleteArticle = selectedArticle
    ? selectedArticle.authorId === currentUserId || isAdmin
    : false;
  const shouldShowEditor = canManageArticles && (!selectedArticle || (isEditMode && canEditSelectedArticle));

  const topicVisibleArticles = visibleArticles.filter((article) => article.topic === selectedTopic);
  const atlasCategories = Array.from(
    new Set([...(topicCategories[selectedTopic] ?? []), ...topicVisibleArticles.map((article) => article.category)])
  ).slice(0, 10);

  const categoryNodes = atlasCategories.map((category, index) => {
    const angle = ((Math.PI * 2) / Math.max(atlasCategories.length, 1)) * index - Math.PI / 2;
    const x = 50 + Math.cos(angle) * 30;
    const y = 50 + Math.sin(angle) * 33;
    return { category, x, y };
  });

  const selectedCategoryNode = categoryNodes.find((item) => item.category === selectedCategory);
  const categoryArticleNodes = topicVisibleArticles
    .filter((article) => article.category === selectedCategory)
    .slice(0, 6)
    .map((article, index) => ({
      article,
      x: 84,
      y: 16 + index * 13,
    }));

  return (
    <>
      <main className={`order-1 space-y-4 lg:order-2 ${shouldShowEditor ? "lg:col-span-2" : ""}`}>
        <section className="atlas-field rounded-2xl p-4 sm:p-5">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  {copy.atlasTitle}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  {selectedTopic} / {selectedCategory}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.atlasText}</p>
              </div>
              <span className="nook-chip">{copy.focusNodes}: {categoryArticleNodes.length}</span>
            </div>

            <div className="relative mt-4 h-[360px] overflow-hidden rounded-2xl border border-border/75 bg-card/55">
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {categoryNodes.map((node) => (
                  <line
                    key={`line-${node.category}`}
                    x1="50%"
                    y1="50%"
                    x2={`${node.x}%`}
                    y2={`${node.y}%`}
                    stroke="rgba(50,93,196,0.35)"
                    strokeWidth="1.2"
                  />
                ))}
                {selectedCategoryNode
                  ? categoryArticleNodes.map((node) => (
                      <line
                        key={`article-line-${node.article.id}`}
                        x1={`${selectedCategoryNode.x}%`}
                        y1={`${selectedCategoryNode.y}%`}
                        x2={`${node.x}%`}
                        y2={`${node.y}%`}
                        stroke="rgba(43,121,170,0.32)"
                        strokeDasharray="5 4"
                        strokeWidth="1.1"
                      />
                    ))
                  : null}
              </svg>

              <Link
                href={buildAppHref(selectedTopic, { query: searchQuery || undefined })}
                className="atlas-center-node atlas-node-enter absolute left-1/2 top-1/2 z-20 w-44 -translate-x-1/2 -translate-y-1/2 px-4 py-3 text-center text-sm font-semibold text-foreground"
                style={{ animationDelay: "80ms" }}
              >
                <div className="inline-flex items-center gap-1.5">
                  <Network className="size-4 text-primary" />
                  {selectedTopic}
                </div>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Центральный узел раздела</p>
              </Link>

              {categoryNodes.map((node, nodeIndex) => {
                const isActive = node.category === selectedCategory;
                return (
                  <Link
                    key={node.category}
                    href={buildAppHref(selectedTopic, {
                      category: node.category,
                      query: searchQuery || undefined,
                    })}
                    className={`atlas-node atlas-node-enter absolute z-10 w-36 -translate-x-1/2 -translate-y-1/2 px-3 py-2 text-xs font-semibold ${
                      isActive ? "atlas-node-active" : ""
                    }`}
                    style={{
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      animationDelay: `${120 + nodeIndex * 45}ms`,
                    }}
                  >
                    <p className="truncate">{node.category}</p>
                  </Link>
                );
              })}

              {categoryArticleNodes.map((node, index) => {
                const isSelected = node.article.id === selectedArticle?.id;
                return (
                  <Link
                    key={node.article.id}
                    href={buildAppHref(selectedTopic, {
                      articleId: node.article.id,
                      category: node.article.category,
                      query: searchQuery || undefined,
                    })}
                    className={`atlas-node atlas-node-enter absolute z-10 w-44 -translate-x-1/2 -translate-y-1/2 px-3 py-2 ${
                      isSelected ? "atlas-node-active" : ""
                    }`}
                    style={{
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      animationDelay: `${220 + index * 55}ms`,
                    }}
                  >
                    <p className="truncate text-xs font-semibold text-foreground">{node.article.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{node.article.summary}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {shouldShowEditor ? (
          <section className="nook-panel rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  {copy.editor}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {selectedArticle ? copy.editArticle : copy.newNote}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.editorText}</p>
              </div>
              {selectedArticle && closeEditorHref ? (
                <Link
                  href={closeEditorHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <FileText className="size-4" />
                  {copy.closeEditor}
                </Link>
              ) : null}
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <div className="nook-panel-soft rounded-xl px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{copy.sectionLabel}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{selectedTopic}</p>
              </div>
              <div className="nook-panel-soft rounded-xl px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{copy.categoryLabel}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{selectedCategory}</p>
              </div>
            </div>

            <ThoughtEditor
              article={selectedArticle}
              topics={topics}
              defaultTopic={selectedTopic}
              topicCategories={topicCategories}
              defaultCategory={selectedCategory}
              canDeleteArticle={canDeleteArticle}
              wikiLinks={wikiLinks}
              showStandalonePreview={false}
            />
          </section>
        ) : selectedArticle ? (
          <section className="nook-panel rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/55 bg-primary/10 px-3 py-1 font-semibold text-primary">
                  {selectedArticle.topic}
                </span>
                <span className="rounded-full border border-border bg-card px-3 py-1 font-semibold text-muted-foreground">
                  {selectedArticle.category}
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {copy.updated} {formatDateTime(selectedArticle.updatedAt)}
                </span>
              </div>
              {editArticleHref && canEditSelectedArticle ? (
                <Link
                  href={editArticleHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <Edit3 className="size-4" />
                  {copy.editButton}
                </Link>
              ) : null}
            </div>

            <h2 className="mt-4 text-[clamp(1.55rem,3vw,2.05rem)] font-semibold tracking-tight text-foreground">
              {selectedArticle.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-[15px]">
              {selectedArticle.summary}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="nook-panel-soft rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  <UserRound className="size-3.5" />
                  {copy.author}
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{selectedArticle.authorName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.created} {formatDateTime(selectedArticle.createdAt)}
                </p>
              </div>

              <div className="nook-panel-soft rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  <PenSquare className="size-3.5" />
                  {copy.lastEditor}
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{selectedArticle.updatedByName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.updated} {formatDateTime(selectedArticle.updatedAt)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-card/90 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpenText className="size-4 text-primary" />
                {copy.reading}
              </div>
              <ArticleContent
                html={selectedArticle.contentHtml}
                wikiLinks={wikiLinks}
                className="max-w-none space-y-4 text-[15px] leading-7 text-foreground"
              />
            </div>
          </section>
        ) : (
          <section className="nook-panel rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-foreground">{copy.noAccessEmptyTitle}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{copy.noAccessEmptyText}</p>
          </section>
        )}
      </main>

      {!shouldShowEditor ? (
        <aside className="order-3 space-y-4">
          <section className="nook-panel rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              {copy.snapshot}
            </p>
            <div className="mt-3 grid gap-2">
              <div className="nook-panel-soft rounded-lg px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {copy.allArticles}
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">{totalArticles}</p>
              </div>
              <div className="nook-panel-soft rounded-lg px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {copy.categoryLabel}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{selectedCategory}</p>
              </div>
              <div className="nook-panel-soft rounded-lg px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {copy.lastUpdate}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : copy.emptyValue}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-dashed border-border bg-card/70 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              Вид карты отражает текущий фильтр и запрос поиска.
            </div>
          </section>
        </aside>
      ) : null}
    </>
  );
}
