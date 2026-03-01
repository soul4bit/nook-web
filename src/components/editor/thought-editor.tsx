"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
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
import { type ArticleRecord } from "@/lib/articles/server";
import { type ArticleTopic } from "@/lib/content/devops-library";
import { cn } from "@/lib/utils";

const copy = {
  emptyTitle: "\u041d\u043e\u0432\u0430\u044f \u0441\u0442\u0430\u0442\u044c\u044f",
  emptyBody:
    "\u0417\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u0443\u0439 \u0440\u0430\u0437\u0431\u043e\u0440, \u043a\u043e\u043c\u0430\u043d\u0434\u044b, \u0432\u044b\u0432\u043e\u0434\u044b \u0438 \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0435 \u043f\u0440\u0430\u043a\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0437\u0430\u043c\u0435\u0442\u043a\u0438 \u043f\u043e \u0437\u0430\u0434\u0430\u0447\u0435.",
  placeholder:
    "\u041f\u0438\u0448\u0438 \u0440\u0430\u0437\u0431\u043e\u0440, \u0448\u043f\u0430\u0440\u0433\u0430\u043b\u043a\u0443, \u043a\u043e\u043c\u0430\u043d\u0434\u044b, \u0432\u044b\u0432\u043e\u0434\u044b \u0438 \u0441\u0432\u043e\u0438 \u0437\u0430\u043c\u0435\u0442\u043a\u0438 \u043f\u043e \u0437\u0430\u0434\u0430\u0447\u0435...",
  saveError: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u044c\u044e.",
  titleRequired: "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a \u0441\u0442\u0430\u0442\u044c\u0438.",
  bodyRequired: "\u0421\u0442\u0430\u0442\u044c\u044f \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043f\u0443\u0441\u0442\u043e\u0439.",
  updated: "\u0421\u0442\u0430\u0442\u044c\u044f \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430.",
  created: "\u0421\u0442\u0430\u0442\u044c\u044f \u0441\u043e\u0437\u0434\u0430\u043d\u0430.",
  titleLabel: "\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a \u0441\u0442\u0430\u0442\u044c\u0438",
  titlePlaceholder: "\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: Kubernetes probes without pain",
  draft: "\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a",
  blocks: "\u0431\u043b\u043e\u043a\u043e\u0432",
  chars: "\u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432",
  topicLabel: "\u0420\u0430\u0437\u0434\u0435\u043b",
  summaryLabel: "\u041a\u043e\u0440\u043e\u0442\u043a\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435",
  summaryPlaceholder:
    "\u041f\u0430\u0440\u0430 \u0441\u0442\u0440\u043e\u043a, \u0447\u0442\u043e\u0431\u044b \u0432 \u0441\u043f\u0438\u0441\u043a\u0435 \u0431\u044b\u043b\u043e \u043f\u043e\u043d\u044f\u0442\u043d\u043e, \u043e \u0447\u0435\u043c \u0441\u0442\u0430\u0442\u044c\u044f",
  bold: "\u0416\u0438\u0440\u043d\u044b\u0439",
  list: "\u0421\u043f\u0438\u0441\u043e\u043a",
  ordered: "\u041d\u0443\u043c\u0435\u0440\u0430\u0446\u0438\u044f",
  quote: "\u0426\u0438\u0442\u0430\u0442\u0430",
  code: "\u041a\u043e\u0434",
  divider: "\u0420\u0430\u0437\u0434\u0435\u043b\u0438\u0442\u0435\u043b\u044c",
  reset: "\u0421\u0431\u0440\u043e\u0441",
  saving: "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c...",
  saveChanges: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f",
  createArticle: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0441\u0442\u0430\u0442\u044c\u044e",
  newDraft: "\u041d\u043e\u0432\u044b\u0439 \u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a",
  deleteArticle: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u044c\u044e",
  deleting: "\u0423\u0434\u0430\u043b\u044f\u0435\u043c...",
  deleteConfirm:
    "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u044c\u044e? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.",
  deleted: "\u0421\u0442\u0430\u0442\u044c\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0430.",
  deleteError: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u044c\u044e.",
  footer:
    "\u0422\u0435\u043a\u0441\u0442 \u0441\u0442\u0430\u0442\u044c\u0438 \u0445\u0440\u0430\u043d\u0438\u0442\u0441\u044f \u0432 PostgreSQL. \u041a\u0430\u0440\u0442\u0438\u043d\u043a\u0438 \u0434\u043b\u044f \u0441\u0442\u0430\u0442\u0435\u0439 \u043b\u0443\u0447\u0448\u0435 \u0434\u0435\u0440\u0436\u0430\u0442\u044c \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u043c\u0438 \u0444\u0430\u0439\u043b\u0430\u043c\u0438 \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0442\u044c \u0432 \u0431\u0430\u0437\u0435 \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u0443\u0442\u044c \u043a \u043d\u0438\u043c. \u042d\u0442\u043e \u0431\u0443\u0434\u0435\u0442 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u043c \u0448\u0430\u0433\u043e\u043c.",
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
        "rounded-xl border-[#2b3531] bg-[#111513] text-[#dce6e0] hover:bg-[#1a201d]",
        active && "border-[#53e6a6] bg-[#53e6a6] text-[#09120e] hover:bg-[#53e6a6]"
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

export function ThoughtEditor({
  article,
  topics,
  defaultTopic,
  topicCategories,
  defaultCategory,
}: ThoughtEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [topic, setTopic] = useState<ArticleTopic>(article?.topic ?? defaultTopic);
  const [category, setCategory] = useState(article?.category ?? defaultCategory);
  const [feedback, setFeedback] = useState<SaveFeedback>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
          "nook-editor min-h-80 rounded-[28px] border border-[#2b3531] bg-[#111513] px-5 py-4 text-[15px] leading-7 text-[#edf4f0] focus-visible:outline-none",
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
  }, [article, defaultCategory, defaultTopic, editor, topics]);

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
          <label htmlFor="article-title" className="text-sm font-medium text-white">
            {copy.titleLabel}
          </label>
          <Input
            id="article-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={copy.titlePlaceholder}
            className="h-12 rounded-2xl border-[#2b3531] bg-[#111513] text-white placeholder:text-[#6f877e]"
          />
        </div>

        <div className="rounded-[24px] border border-[#2b3531] bg-[#181e1b] px-4 py-3 text-sm leading-6 text-[#8ca39b]">
          <p className="font-medium text-white">{copy.draft}</p>
          <p className="mt-2">
            {stats.paragraphs} {copy.blocks}
          </p>
          <p>
            {stats.chars} {copy.chars}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_220px_minmax(0,1fr)]">
        <div className="space-y-2">
          <label htmlFor="article-topic" className="text-sm font-medium text-white">
            {copy.topicLabel}
          </label>
          <select
            id="article-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value as ArticleTopic)}
            className="h-12 w-full rounded-2xl border border-[#2b3531] bg-[#181e1b] px-4 text-sm text-white outline-none focus-visible:border-[#53e6a6]"
          >
            {topics.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="article-category" className="text-sm font-medium text-white">
            Категория
          </label>
          <Input
            id="article-category"
            list="article-category-list"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Например: systemd"
            className="h-12 rounded-2xl border-[#2b3531] bg-[#181e1b] text-white placeholder:text-[#6f877e]"
          />
          <datalist id="article-category-list">
            {availableCategories.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <label htmlFor="article-summary" className="text-sm font-medium text-white">
            {copy.summaryLabel}
          </label>
          <Input
            id="article-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={copy.summaryPlaceholder}
            className="h-12 rounded-2xl border-[#2b3531] bg-[#181e1b] text-white placeholder:text-[#6f877e]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <EditorButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
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
        <EditorButton onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus />
          {copy.divider}
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          <Type />
          {copy.reset}
        </EditorButton>
      </div>

      <EditorContent editor={editor} />

      {feedback ? (
        <div
          className={cn(
            "rounded-[24px] border px-4 py-3 text-sm leading-6",
            feedback.tone === "success"
              ? "border-[#245945] bg-[#14241d] text-[#53e6a6]"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          )}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="rounded-2xl bg-[#53e6a6] px-5 text-[#09120e] hover:bg-[#46ce93]"
          onClick={handleSave}
          disabled={isSaving || isDeleting}
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
          className="rounded-2xl border-[#2b3531] bg-[#181e1b] text-white hover:bg-[#1d2521]"
          onClick={handleNewDraft}
          disabled={isSaving || isDeleting}
        >
          {copy.newDraft}
        </Button>

        {article ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
            onClick={handleDelete}
            disabled={isSaving || isDeleting}
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

      <div className="rounded-[24px] border border-[#2b3531] bg-[#181e1b] p-4 text-sm leading-7 text-[#8ca39b]">
        {copy.footer}
      </div>
    </div>
  );
}
