import { redirect } from "next/navigation";
import { CheckCircle2, Database, Search, ShieldCheck, Sparkles } from "lucide-react";
import { AuthForms } from "@/components/auth/auth-forms";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { getCurrentSession } from "@/lib/auth/session";

const checklist = [
  {
    title: "Заметки не улетают в чатик",
    text: "Статьи и runbook живут в PostgreSQL, а не в 500 сообщениях с мемами.",
    icon: Database,
  },
  {
    title: "Поиск реально ищет",
    text: "FTS по заголовку и тексту помогает найти ответ быстрее, чем спросить в общем канале.",
    icon: Search,
  },
  {
    title: "Доступ под контролем",
    text: "Регистрация через модерацию, а попытки входа проходят guard-проверки.",
    icon: ShieldCheck,
  },
] as const;

export default async function AuthPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <main className="mx-auto grid w-full max-w-[1240px] gap-5 lg:grid-cols-[1fr_minmax(430px,0.95fr)]">
        <section className="nook-shell rounded-3xl p-6 sm:p-8">
          <KnowledgeLogo subtitle="Контур Знаний для DevOps-команды" />

          <div className="mt-8 space-y-4">
            <span className="nook-kicker">не скучная документация</span>
            <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              Хватит терять знания.
              <br />
              Сделай вики, в которую хочется заходить.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Контур Знаний хранит DevOps-практики в нормальной структуре: статьи, wiki-ссылки, поиск и
              история решений. Меньше хаоса, больше времени на реальную работу.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <article className="nook-panel rounded-2xl p-4 sm:col-span-2">
              <p className="text-sm font-medium text-foreground">
                Контур Знаний помогает держать практику команды в одном месте и не терять рабочие решения.
              </p>
            </article>

            {checklist.map((item, index) => (
              <article
                key={item.title}
                className={`nook-panel rounded-2xl p-4 ${index === 1 ? "sm:translate-y-1" : ""}`}
              >
                <div className="inline-flex size-10 items-center justify-center rounded-lg border-2 border-border bg-accent text-foreground">
                  <item.icon className="size-4" />
                </div>
                <h2 className="mt-3 text-sm font-semibold text-foreground">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>PostgreSQL + Better Auth + живой редактор статей</span>
            <Sparkles className="size-3.5 text-orange-500" />
          </div>
        </section>

        <section className="nook-shell rounded-3xl p-6 sm:p-8">
          <AuthForms />
        </section>
      </main>
    </div>
  );
}
