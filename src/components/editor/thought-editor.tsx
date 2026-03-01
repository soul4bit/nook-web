"use client";

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  ImageUp,
  List,
  ListOrdered,
  LoaderCircle,
  Minus,
  Quote,
  Save,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type ArticleRecord } from "@/lib/articles/server";
import { type ArticleTopic } from "@/lib/content/devops-library";
import { NookImage } from "@/lib/editor/nook-image";
import { cn } from "@/lib/utils";

const copy = {
  emptyTitle: "Новая статья",
  emptyBody:
    "Зафиксируйте разбор, команды и практические выводы, чтобы потом быстро вернуться к ним.",
  placeholder:
    "Пишите пошаговый разбор, команды, примеры конфигов и короткие выводы по задаче...",
  saveError: "Не удалось сохранить статью.",
  titleRequired: "Укажите заголовок статьи.",
  bodyRequired: "Статья не может быть пустой.",
  updated: "Статья обновлена.",
  created: "Статья создана.",
  titleLabel: "Заголовок статьи",
  titlePlaceholder: "Например: Kubernetes probes без боли",
  draft: "Черновик",
  blocks: "блоков",
  chars: "символов",
  topicLabel: "Раздел",
  categoryLabel: "Категория",
  categoryPlaceholder: "Например: systemd",
  summaryLabel: "Короткое описание",
  summaryPlaceholder:
    "2-3 предложения, чтобы в списке было понятно, о чем статья",
  bold: "Жирный",
  list: "Список",
  ordered: "Нумерация",
  quote: "Цитата",
  code: "Код",
  divider: "Разделитель",
  reset: "Сброс",
  saving: "Сохраняем...",
  saveChanges: "Сохранить изменения",
  createArticle: "Создать статью",
  newDraft: "Новый черновик",
  image: "Картинка",
  uploadingImage: "Загружаем картинку...",
  imageUploaded: "Картинка добавлена в статью.",
  imageUploadError: "Не удалось загрузить картинку.",
  deleteArticle: "Удалить статью",
  deleting: "Удаляем...",
  deleteConfirm: "Удалить статью? Это действие нельзя отменить.",
  deleteError: "Не удалось удалить статью.",
  footer:
    "Текст хранится в PostgreSQL и в markdown-представлении, поэтому материалы можно будет выгружать отдельно.",
} as const;

const emptyDocument = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: copy.emptyTitle }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: copy.emptyBody }],
    },
  ],
};

const emptyHtml = `
  <h2>${copy.emptyTitle}</h2>
  <p>${copy.emptyBody}</p>
`;

type ThoughtEditorProps = {
  article: ArticleRecord | null;
  topics: readonly ArticleTopic[];
  defaultTopic: ArticleTopic;
  topicCategories: Record<ArticleTopic, readonly string[]>;
  defaultCategory: string;
};

type SaveFeedback = {
  tone: "error" | "success";
  text: string;
} | null;

type ArticleResponse = {
  article: ArticleRecord;
};

type DeleteResponse = {
  success: boolean;
};

type EditorButtonProps = {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function EditorButton({ active = false, onClick, children }: EditorButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        "rounded-xl border-slate-700/80 bg-[#0f1a25] text-slate-300 hover:bg-[#162431]",
        active && "border-[#2f556d] bg-[#163245] text-[#49d4b8] hover:bg-[#1b3b52]"
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

async function saveArticleRequest(articleId: string | null, payload: Record<string, unknown>) {
  const response = await fetch(articleId ? `/api/articles/${articleId}` : "/api/articles", {
    method: articleId ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as ArticleResponse | { message?: string };

  if (!response.ok) {
    const message = "message" in result ? result.message : undefined;
    throw new Error(message ?? copy.saveError);
  }

  return result as ArticleResponse;
}

async function deleteArticleRequest(articleId: string) {
  const response = await fetch(`/api/articles/${articleId}`, {
    method: "DELETE",
    credentials: "include",
  });

  const result = (await response.json()) as DeleteResponse | { message?: string };

  if (!response.ok) {
    const message = "message" in result ? result.message : undefined;
    throw new Error(message ?? copy.deleteError);
  }

  return result as DeleteResponse;
}

async function uploadArticleImage(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/articles/image", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const result = (await response.json()) as { imageUrl?: string; message?: string };

  if (!response.ok || !result.imageUrl) {
    throw new Error(result.message ?? copy.imageUploadError);
  }

  return result.imageUrl;
}

export function ThoughtEditor({
  article,
  topics,
  defaultTopic,
  topicCategories,
  defaultCategory,
}: ThoughtEditorProps) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(article?.title ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [topic, setTopic] = useState<ArticleTopic>(article?.topic ?? defaultTopic);
  const [category, setCategory] = useState(article?.category ?? defaultCategory);
  const [feedback, setFeedback] = useState<SaveFeedback>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [stats, setStats] = useState({ chars: 0, paragraphs: 0 });
  const availableCategories = useMemo(
    () => topicCategories[topic] ?? [],
    [topic, topicCategories]
  );

  const initialJson = useMemo(
    () => article?.contentJson ?? emptyDocument,
    [article?.contentJson]
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      NookImage,
      Placeholder.configure({
        placeholder: copy.placeholder,
      }),
    ],
    content: initialJson,
    immediatelyRender: false,
    onCreate: ({ editor: currentEditor }) => {
      const text = currentEditor.getText().trim();
      setStats({
        chars: text.length,
        paragraphs: currentEditor.getJSON().content?.length ?? 0,
      });
    },
    onUpdate: ({ editor: currentEditor }) => {
      const text = currentEditor.getText().trim();
      setStats({
        chars: text.length,
        paragraphs: currentEditor.getJSON().content?.length ?? 0,
      });
    },
    editorProps: {
      attributes: {
        class:
          "nook-editor min-h-80 rounded-[22px] border border-slate-700/80 bg-[#0f1a25] px-5 py-4 text-[15px] leading-7 text-slate-300 focus-visible:outline-none",
      },
    },
  });

  useEffect(() => {
    setTitle(article?.title ?? "");
    setSummary(article?.summary ?? "");
    setTopic(article?.topic ?? defaultTopic);
    setCategory(article?.category ?? defaultCategory);
    setFeedback(null);

    if (!editor) {
      return;
    }

    editor.commands.setContent(article?.contentJson ?? emptyDocument);
  }, [article, defaultCategory, defaultTopic, editor]);

  useEffect(() => {
    if (!category.trim()) {
      setCategory(availableCategories[0] ?? "Общее");
      return;
    }

    if (!availableCategories.includes(category)) {
      setCategory(availableCategories[0] ?? "Общее");
    }
  }, [availableCategories, category]);

  async function handleSave() {
    if (!editor) {
      return;
    }

    const trimmedTitle = title.trim();
    const contentText = editor.getText().trim();

    if (!trimmedTitle) {
      setFeedback({ tone: "error", text: copy.titleRequired });
      return;
    }

    if (!contentText) {
      setFeedback({ tone: "error", text: copy.bodyRequired });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const result = await saveArticleRequest(article?.id ?? null, {
        title: trimmedTitle,
        topic,
        category,
        summary,
        contentHtml: editor.getHTML(),
        contentJson: editor.getJSON(),
        contentText,
      });

      setFeedback({
        tone: "success",
        text: article ? copy.updated : copy.created,
      });
      router.replace(
        `/app?topic=${encodeURIComponent(result.article.topic)}&category=${encodeURIComponent(
          result.article.category
        )}&draft=0&article=${result.article.id}`
      );
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : copy.saveError,
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleNewDraft() {
    setTitle("");
    setSummary("");
    setTopic(defaultTopic);
    setCategory(defaultCategory);
    setFeedback(null);
    editor?.commands.setContent(emptyHtml);
    router.replace(
      `/app?topic=${encodeURIComponent(defaultTopic)}&category=${encodeURIComponent(
        defaultCategory
      )}&draft=1`
    );
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !editor) {
      return;
    }

    setIsUploadingImage(true);
    setFeedback(null);

    try {
      const imageUrl = await uploadArticleImage(file);
      editor
        .chain()
        .focus()
        .insertContent({
          type: "nookImage",
          attrs: {
            src: imageUrl,
            alt: title.trim() || "Article image",
            title: title.trim() || undefined,
          },
        })
        .run();
      setFeedback({
        tone: "success",
        text: copy.imageUploaded,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : copy.imageUploadError,
      });
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  async function handleDelete() {
    if (!article) {
      return;
    }

    if (!window.confirm(copy.deleteConfirm)) {
      return;
    }

    setIsDeleting(true);
    setFeedback(null);

    try {
      await deleteArticleRequest(article.id);
      router.replace(
        `/app?topic=${encodeURIComponent(article.topic)}&category=${encodeURIComponent(
          article.category
        )}`
      );
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : copy.deleteError,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  if (!editor) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <label htmlFor="article-title" className="text-sm font-medium text-slate-300">
            {copy.titleLabel}
          </label>
          <Input
            id="article-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={copy.titlePlaceholder}
            className="h-12 rounded-2xl border-slate-700/80 bg-[#0f1a25] text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="rounded-[18px] border border-slate-700/80 bg-[#132231] px-4 py-3 text-sm leading-6 text-slate-400">
          <p className="font-semibold text-slate-200">{copy.draft}</p>
          <p className="mt-2">
            {stats.paragraphs} {copy.blocks}
          </p>
          <p>
            {stats.chars} {copy.chars}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_220px]">
        <div className="space-y-2">
          <label htmlFor="article-topic" className="text-sm font-medium text-slate-300">
            {copy.topicLabel}
          </label>
          <select
            id="article-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value as ArticleTopic)}
            className="h-12 w-full rounded-2xl border border-slate-700/80 bg-[#0f1a25] px-4 text-sm text-slate-100 outline-none focus-visible:border-[#49d4b8]"
          >
            {topics.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="article-category" className="text-sm font-medium text-slate-300">
            {copy.categoryLabel}
          </label>
          <Input
            id="article-category"
            list="article-category-list"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={copy.categoryPlaceholder}
            className="h-12 rounded-2xl border-slate-700/80 bg-[#0f1a25] text-slate-100 placeholder:text-slate-500"
          />
          <datalist id="article-category-list">
            {availableCategories.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="article-summary" className="text-sm font-medium text-slate-300">
          {copy.summaryLabel}
        </label>
        <Textarea
          id="article-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder={copy.summaryPlaceholder}
          rows={3}
          className="min-h-12 rounded-2xl border-slate-700/80 bg-[#0f1a25] text-slate-100 placeholder:text-slate-500"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <EditorButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
          {copy.bold}
        </EditorButton>
        <EditorButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
          H2
        </EditorButton>
        <EditorButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 />
          H3
        </EditorButton>
        <EditorButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
          {copy.list}
        </EditorButton>
        <EditorButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
          {copy.ordered}
        </EditorButton>
        <EditorButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
          {copy.quote}
        </EditorButton>
        <EditorButton
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 />
          {copy.code}
        </EditorButton>
        <EditorButton onClick={() => imageInputRef.current?.click()}>
          <ImageUp />
          {isUploadingImage ? copy.uploadingImage : copy.image}
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus />
          {copy.divider}
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          <Type />
          {copy.reset}
        </EditorButton>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleImageChange}
      />

      <EditorContent editor={editor} />

      {feedback ? (
        <div
          className={cn(
            "rounded-[18px] border px-4 py-3 text-sm leading-6",
            feedback.tone === "success"
              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
              : "border-rose-500/40 bg-rose-950/40 text-rose-300"
          )}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="rounded-2xl bg-[#1e9f86] px-5 text-white hover:bg-[#1b8b75]"
          onClick={handleSave}
          disabled={isSaving || isDeleting || isUploadingImage}
        >
          {isSaving ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              {copy.saving}
            </>
          ) : (
            <>
              <Save className="size-4" />
              {article ? copy.saveChanges : copy.createArticle}
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="rounded-2xl border-slate-700/80 bg-[#0f1a25] text-slate-300 hover:bg-[#162431]"
          onClick={handleNewDraft}
          disabled={isSaving || isDeleting || isUploadingImage}
        >
          {copy.newDraft}
        </Button>

        {article ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-100"
            onClick={handleDelete}
            disabled={isSaving || isDeleting || isUploadingImage}
          >
            {isDeleting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                {copy.deleting}
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                {copy.deleteArticle}
              </>
            )}
          </Button>
        ) : null}
      </div>

      <div className="rounded-[18px] border border-slate-700/80 bg-[#132231] p-4 text-sm leading-7 text-slate-400">
        {copy.footer}
      </div>
    </div>
  );
}


