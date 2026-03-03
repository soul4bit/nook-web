"use client";

import { useEffect, useState } from "react";
import { BookOpenText, Clock3, PenSquare, SearchSlash, UserRound } from "lucide-react";
import { ArticleContent } from "@/components/articles/article-content";
import { ThoughtEditor, type ThoughtEditorPreview } from "@/components/editor/thought-editor";
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
  nothingToRead: "Статья не выбрана",
  nothingToReadText:
    "Выберите материал в навигации слева или создайте новый. После сохранения он сразу появится в нужной категории.",
  editor: "Редактор",
  editArticle: "Редактирование статьи",
  newNote: "Создание статьи",
  editorText:
    "Изменения сохраняются в PostgreSQL и сразу отображаются в структуре разделов.",
  draft: "Черновик",
  draftTitle: "Новая статья",
  previewSummaryFallback: "Добавьте короткое описание, и оно появится под заголовком статьи.",
  previewBodyFallback: "Начните писать в редакторе справа, и здесь сразу появится предпросмотр.",
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
  displayName: string;
  wikiLinks: WikiLink[];
};

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildInitialPreview(
  selectedArticle: EditorArticle,
  selectedTopic: ArticleTopic,
  selectedCategory: string
): ThoughtEditorPreview {
  if (selectedArticle) {
    return {
      title: selectedArticle.title,
      summary: selectedArticle.summary,
      topic: selectedArticle.topic,
      category: selectedArticle.category,
      contentHtml: selectedArticle.contentHtml,
      hasContent: Boolean(selectedArticle.contentText.trim()),
    };
  }

  return {
    title: "",
    summary: "",
    topic: selectedTopic,
    category: selectedCategory,
    contentHtml: "",
    hasContent: false,
  };
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
  displayName,
  wikiLinks,
}: WorkspacePanelsProps) {
  const [livePreview, setLivePreview] = useState<ThoughtEditorPreview>(() =>
    buildInitialPreview(selectedArticle, selectedTopic, selectedCategory)
  );

  useEffect(() => {
    setLivePreview(buildInitialPreview(selectedArticle, selectedTopic, selectedCategory));
  }, [selectedArticle, selectedTopic, selectedCategory]);

  const previewTitle = livePreview.title || copy.draftTitle;
  const previewSummary = livePreview.summary || copy.previewSummaryFallback;
  const previewTopic = livePreview.topic || selectedTopic;
  const previewCategory = livePreview.category || selectedCategory;
  const authorName = selectedArticle?.authorName ?? displayName;
  const lastEditorName = selectedArticle?.updatedByName ?? displayName;
  const createdAt = selectedArticle ? formatDateTime(selectedArticle.createdAt) : copy.draft;
  const updatedAt = selectedArticle ? formatDateTime(selectedArticle.updatedAt) : copy.draft;
  const canDeleteArticle = selectedArticle
    ? selectedArticle.authorId === currentUserId || isAdmin
    : false;

  return (
    <>
      <main className="order-1 space-y-4 lg:order-2">
        <section className="nook-surface rounded-2xl p-5 sm:p-6">
          {selectedArticle || livePreview.title || livePreview.summary || livePreview.hasContent ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-700">
                  {previewTopic}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                  {previewCategory}
                </span>
                {selectedArticle ? (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Clock3 className="size-3.5" />
                    {copy.updated} {updatedAt}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
                    {copy.draft}
                  </span>
                )}
              </div>

              <h2 className="mt-4 text-[clamp(1.65rem,3vw,2.05rem)] font-semibold tracking-tight text-slate-900">
                {previewTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-[15px]">{previewSummary}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-slate-500">
                    <UserRound className="size-3.5" />
                    {copy.author}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{authorName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {copy.created} {createdAt}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-slate-500">
                    <PenSquare className="size-3.5" />
                    {copy.lastEditor}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{lastEditorName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {copy.updated} {updatedAt}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <BookOpenText className="size-4 text-sky-700" />
                  {copy.reading}
                </div>
                {livePreview.hasContent ? (
                  <ArticleContent
                    html={livePreview.contentHtml}
                    wikiLinks={wikiLinks}
                    className="nook-editor-light max-w-none space-y-4 text-[15px] leading-7 text-slate-700"
                  />
                ) : (
                  <p className="text-sm leading-7 text-slate-500">{copy.previewBodyFallback}</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <SearchSlash className="size-6" />
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-slate-900">{copy.nothingToRead}</h2>
              <p className="mt-2 max-w-md text-sm leading-7 text-slate-600">{copy.nothingToReadText}</p>
            </div>
          )}
        </section>
      </main>

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
              <p className="mt-1 text-sm font-semibold text-slate-900">{previewCategory}</p>
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

        <section className="nook-surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {copy.editor}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            {selectedArticle ? copy.editArticle : copy.newNote}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.editorText}</p>

          <div className="mt-4">
            <ThoughtEditor
              article={selectedArticle}
              topics={topics}
              defaultTopic={selectedTopic}
              topicCategories={topicCategories}
              defaultCategory={selectedCategory}
              canDeleteArticle={canDeleteArticle}
              wikiLinks={wikiLinks}
              showStandalonePreview={false}
              onPreviewChange={setLivePreview}
            />
          </div>
        </section>
      </aside>
    </>
  );
}
