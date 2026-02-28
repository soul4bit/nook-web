import { redirect } from "next/navigation";
import {
  BookOpenText,
  Boxes,
  Cable,
  Clock3,
  FolderKanban,
  HardDriveUpload,
  Plus,
  ServerCog,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThoughtEditor } from "@/components/editor/thought-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { devopsArticles, devopsTopics, featuredArticle } from "@/lib/content/devops-library";

const topicIcons = [ServerCog, Boxes, Cable, FolderKanban, HardDriveUpload, FolderKanban, HardDriveUpload];

export default async function AppPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth");
  }

  const displayName = session.user.name?.trim() || session.user.email;

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f7f8f4_0%,#edf3ef_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-[32px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(39,70,63,0.07)] sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <span className="rounded-full border border-slate-200 bg-[#edf3ef] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                DevOps notebook
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl">
                  {displayName}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                  Здесь будет личная база по Linux, Docker, сетям, Ansible, Kubernetes,
                  Terraform и CI/CD. Не wiki ради wiki, а рабочее место для заметок,
                  шпаргалок и статей, к которым реально возвращаются.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="rounded-2xl bg-[#2f7a67] px-5 text-white hover:bg-[#286857]"
              >
                <Plus className="size-4" />
                Новая статья
              </Button>
              <SignOutButton />
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-[0_18px_50px_rgba(39,70,63,0.06)]">
              <CardHeader className="gap-3">
                <CardTitle className="text-lg text-slate-900">Направления</CardTitle>
                <CardDescription className="text-slate-600">
                  Блоки знаний, из которых будет собрана твоя личная DevOps-библиотека.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {devopsTopics.map((topic, index) => {
                  const Icon = topicIcons[index] ?? ServerCog;

                  return (
                    <article
                      key={topic.name}
                      className="rounded-[22px] border border-slate-200 bg-[#f4f7f4] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
                            <Icon className="size-4" />
                          </div>
                          <div>
                            <h2 className="text-sm font-semibold text-slate-900">{topic.name}</h2>
                            <p className="mt-1 text-xs text-slate-500">{topic.count} статей</p>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{topic.summary}</p>
                    </article>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-[0_18px_50px_rgba(39,70,63,0.06)]">
              <CardHeader className="gap-3">
                <CardTitle className="text-lg text-slate-900">Хранение</CardTitle>
                <CardDescription className="text-slate-600">
                  Базовая схема хранения для этой версии Nook.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-[#f4f7f4] px-4 py-3">
                  Статьи и метаданные: PostgreSQL
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#f4f7f4] px-4 py-3">
                  Картинки: отдельные файлы на сервере
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#f4f7f4] px-4 py-3">
                  В базе храним только путь к изображению и контент статьи
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="grid gap-6">
            <Card className="rounded-[32px] border-slate-200 bg-white/92 shadow-[0_24px_70px_rgba(39,70,63,0.08)]">
              <CardHeader className="gap-4 border-b border-slate-200 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  {devopsTopics.map((topic) => (
                    <Badge
                      key={topic.name}
                      variant="outline"
                      className="rounded-full border-slate-200 bg-[#f4f7f4] px-3 py-1 text-slate-700"
                    >
                      {topic.name}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl text-slate-900 sm:text-3xl">
                    Последние статьи
                  </CardTitle>
                  <CardDescription className="max-w-3xl text-base leading-7 text-slate-600">
                    Здесь будет лента технических заметок: короткие разборы, чеклисты, команды и
                    полноценные статьи по твоим DevOps-направлениям.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                {devopsArticles.map((article) => (
                  <article
                    key={article.title}
                    className="rounded-[26px] border border-slate-200 bg-[#f6f8f6] p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-[#2f7a67] px-3 py-1 text-white">
                        {article.topic}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-600"
                      >
                        {article.level}
                      </Badge>
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-slate-900">{article.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{article.summary}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-teal-700/75">
                      <Clock3 className="size-3.5" />
                      обновлено {article.updatedAt}
                    </div>
                  </article>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-slate-200 bg-white/92 shadow-[0_24px_70px_rgba(39,70,63,0.08)]">
              <CardHeader className="gap-3 border-b border-slate-200 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-[#2f7a67] px-3 py-1 text-white">
                    {featuredArticle.topic}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-200 bg-[#f4f7f4] px-3 py-1 text-slate-600"
                  >
                    {featuredArticle.readingTime}
                  </Badge>
                </div>
                <CardTitle className="text-2xl text-slate-900 sm:text-3xl">
                  {featuredArticle.title}
                </CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7 text-slate-600">
                  {featuredArticle.summary}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-5">
                  <div className="rounded-[26px] border border-slate-200 bg-[#f5f8f5] p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
                      <BookOpenText className="size-4" />
                      Тело статьи
                    </div>
                    <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
                      {featuredArticle.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-slate-200 bg-slate-950 p-5 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
                      Commands
                    </p>
                    <div className="mt-4 space-y-2 font-mono text-sm leading-7">
                      {featuredArticle.commands.map((command) => (
                        <div key={command} className="rounded-2xl bg-white/5 px-4 py-3">
                          {command}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-slate-200 bg-[#f5f8f5] p-5">
                  <p className="text-sm font-medium text-slate-900">Чеклист</p>
                  <div className="mt-4 space-y-3">
                    {featuredArticle.checklist.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-slate-200 bg-white/92 shadow-[0_24px_70px_rgba(39,70,63,0.08)]">
              <CardHeader className="gap-3 border-b border-slate-200 pb-6">
                <CardTitle className="text-2xl text-slate-900 sm:text-3xl">
                  Редактор статьи
                </CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7 text-slate-600">
                  Для DevOps-заметок нужен не просто textarea, а редактор, в котором удобно
                  писать команды, чеклисты и длинные разборы. На этом шаге оставляем Tiptap и
                  усиливаем его под технический контент.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ThoughtEditor />
              </CardContent>
            </Card>
          </section>
        </section>
      </main>
    </div>
  );
}
