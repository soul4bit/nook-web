import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpenText,
  KeyRound,
  NotebookTabs,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";
import { AuthForms } from "@/components/auth/auth-forms";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AuthPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/app");
  }

  const journey = [
    {
      title: "Вход за 1 шаг",
      description: "Почта и пароль на одном экране. Без лишних переходов между страницами.",
      icon: KeyRound,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      title: "Заявка на регистрацию",
      description: "Новый доступ отправляется в модерацию и подтверждается через почту.",
      icon: UserRoundPlus,
      tone: "bg-sky-100 text-sky-700",
    },
    {
      title: "Быстрое восстановление",
      description: "Если пароль забыт, ссылка для сброса приходит сразу и ведет в безопасную форму.",
      icon: ShieldCheck,
      tone: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <div className="min-h-screen px-3 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto grid w-full max-w-[1480px] gap-4 lg:grid-cols-[1.1fr_minmax(440px,0.9fr)]">
        <section className="nook-shell rounded-[32px] p-6 lg:p-9 xl:p-10">
          <KnowledgeLogo subtitle="Защищенная база команды" />

          <div className="mt-9 space-y-5">
            <span className="nook-kicker">
              <BookOpenText className="size-3.5" />
              Auth control center
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.45rem] lg:leading-[1.05]">
              Авторизация и регистрация в одном понятном потоке.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">
              Выберите режим справа: вход, заявка на регистрацию или восстановление пароля. Каждое
              действие выполняется на месте, поэтому путь до рабочей области короче и удобнее.
            </p>
          </div>

          <div className="mt-10 grid gap-4 xl:grid-cols-3">
            {journey.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.045)]"
              >
                <div className={`flex size-11 items-center justify-center rounded-xl ${item.tone}`}>
                  <item.icon className="size-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <NotebookTabs className="size-4 text-sky-700" />
                Что меняется после входа
              </div>
              <ul className="mt-3 space-y-2.5 text-sm leading-7 text-slate-600">
                <li className="flex items-start gap-2.5">
                  <ArrowRight className="mt-1 size-4 text-sky-600" />
                  Сразу попадаете в рабочую область со статьями и разделами.
                </li>
                <li className="flex items-start gap-2.5">
                  <ArrowRight className="mt-1 size-4 text-sky-600" />
                  Для новых пользователей по умолчанию открыт только режим просмотра.
                </li>
                <li className="flex items-start gap-2.5">
                  <ArrowRight className="mt-1 size-4 text-sky-600" />
                  Права на создание и редактирование администратор выдает отдельно.
                </li>
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ShieldCheck className="size-4 text-emerald-700" />
                Безопасность
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Почта подтверждается отдельно, а каждый запрос на регистрацию проходит
                админ-модерацию. Это уменьшает шум и защищает приватную базу.
              </p>
            </article>
          </div>
        </section>

        <section className="flex items-start lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:items-stretch">
          <AuthForms />
        </section>
      </main>
    </div>
  );
}
