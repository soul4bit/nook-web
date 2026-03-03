"use client";

import Link from "next/link";
import { BookOpenText, Clock3, PenSquare, UserRound } from "lucide-react";
import { ArticleContent } from "@/components/articles/article-content";
import { ThoughtEditor } from "@/components/editor/thought-editor";
import { type ArticleTopic } from "@/lib/content/devops-library";

const copy = {
  snapshot: "Состояние",
  allArticles: "Всего статей",
  lastUpdate: "Последнее обновление",
  emptyValue: "Пока нет данных",
  updated: "Обновлено",
  created: "Создано",
  author: "Автор",
  lastEditor: "Последний редактор",
  reading: "Просмотр статьи",
  editor: "Редактор",
  editArticle: "Редактирование статьи",
  newNote: "Создание статьи",
  editorText:
    "Изменения сохраняются в PostgreSQL и сразу отображаются в структуре разделов.",
  editButton: "Редактировать",
  previewButton: "Предпросмотр",
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
  isEditMode: boolean;
  editArticleHref: string | null;
  closeEditorHref: string | null;
  wikiLinks: WikiLink[];
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
  isEditMode,
  editArticleHref,
  closeEditorHref,
  wikiLinks,
}: WorkspacePanelsProps) {
  const canDeleteArticle = selectedArticle
    ? selectedArticle.authorId === currentUserId || isAdmin
    : false;
  const shouldShowEditor = !selectedArticle || isEditMode;

  return (
    <>
      <main className={`order-1 space-y-4 lg:order-2 ${shouldShowEditor ? "lg:col-span-2" : ""}`}>
        {shouldShowEditor ? (
          <section className="nook-surface rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {copy.editor}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {selectedArticle ? copy.editArticle : copy.newNote}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy.editorText}</p>
              </div>
              {selectedArticle && closeEditorHref ? (
                <Link
                  href={closeEditorHref}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copy.previewButton}
                </Link>
              ) : null}
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
          <section className="nook-surface rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-700">
                  {selectedArticle.topic}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                  {selectedArticle.category}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Clock3 className="size-3.5" />
                  {copy.updated} {formatDateTime(selectedArticle.updatedAt)}
                </span>
              </div>
              {editArticleHref ? (
                <Link
                  href={editArticleHref}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copy.editButton}
                </Link>
              ) : null}
            </div>

            <h2 className="mt-4 text-[clamp(1.65rem,3vw,2.05rem)] font-semibold tracking-tight text-slate-900">
              {selectedArticle.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-[15px]">
              {selectedArticle.summary}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-slate-500">
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

              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-slate-500">
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

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BookOpenText className="size-4 text-sky-700" />
                {copy.reading}
              </div>
              <ArticleContent
                html={selectedArticle.contentHtml}
                wikiLinks={wikiLinks}
                className="nook-editor-light max-w-none space-y-4 text-[15px] leading-7 text-slate-700"
              />
            </div>
          </section>
        ) : null}
      </main>

      {!shouldShowEditor ? (
        <aside className="order-3 space-y-3 sm:space-y-4">
          <section className="nook-surface rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {copy.snapshot}
            </p>
            <div className="mt-3 grid gap-2">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
                  {copy.allArticles}
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{totalArticles}</p>
              </div>
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Категория</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCategory}</p>
              </div>
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
                  {copy.lastUpdate}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : copy.emptyValue}
                </p>
              </div>
            </div>
          </section>
        </aside>
      ) : null}
    </>
  );
}
