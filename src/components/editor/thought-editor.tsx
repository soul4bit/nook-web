"use client";

import { useState } from "react";
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
  Minus,
  Quote,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initialContent = `
  <h2>Docker image size audit</h2>
  <p>Задача: быстро понять, почему образ начал расти и что в нем действительно лишнее.</p>
  <ul>
    <li>проверить build context</li>
    <li>посмотреть историю слоев</li>
    <li>отделить build stage от runtime stage</li>
  </ul>
  <p>Дальше можно добавить команды, вывод и короткие выводы по итогу разбора.</p>
`;

type EditorButtonProps = {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function EditorButton({ active = false, onClick, children }: EditorButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        "rounded-xl border-slate-200 bg-white/80 text-slate-900 hover:bg-[#edf3ef]",
        active && "border-[#2f7a67] bg-[#2f7a67] text-white hover:bg-[#2f7a67]"
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ThoughtEditor() {
  const [title, setTitle] = useState("Новая статья");
  const [stats, setStats] = useState({ chars: 0, paragraphs: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Пиши разбор, шпаргалку, команды, выводы и свои заметки по задаче...",
      }),
    ],
    content: initialContent,
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
          "nook-editor min-h-80 rounded-[28px] border border-slate-200 bg-white/92 px-5 py-4 text-[15px] leading-7 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus-visible:outline-none",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <label htmlFor="article-title" className="text-sm font-medium text-slate-900">
            Заголовок статьи
          </label>
          <Input
            id="article-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Kubernetes probes without pain"
            className="h-12 rounded-2xl border-slate-200 bg-white text-slate-900"
          />
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-[#f4f7f4] px-4 py-3 text-sm leading-6 text-slate-600">
          <p className="font-medium text-slate-900">Черновик</p>
          <p className="mt-2">{stats.paragraphs} блоков</p>
          <p>{stats.chars} символов</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <EditorButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold />
          Жирный
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
          Список
        </EditorButton>
        <EditorButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
          Нумерация
        </EditorButton>
        <EditorButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
          Цитата
        </EditorButton>
        <EditorButton
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 />
          Код
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus />
          Разделитель
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          <Type />
          Сброс
        </EditorButton>
      </div>

      <EditorContent editor={editor} />

      <div className="rounded-[24px] border border-slate-200 bg-[#f4f7f4] p-4 text-sm leading-7 text-slate-600">
        Текст статьи будем хранить в PostgreSQL. Картинки для статей лучше держать отдельными
        файлами на сервере и сохранять в базе только путь к ним. Для первой версии это надежнее,
        чем тащить бинарные файлы в базу.
      </div>
    </div>
  );
}
