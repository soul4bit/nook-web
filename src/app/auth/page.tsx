import { redirect } from "next/navigation";
import { BookOpenText, Clock3, NotebookTabs, ShieldCheck } from "lucide-react";
import { AuthForms } from "@/components/auth/auth-forms";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AuthPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-[#edf1f4] px-3 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto grid max-w-[1560px] gap-4 lg:grid-cols-[1.05fr_minmax(420px,0.95fr)]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:p-9 xl:p-10">
          <KnowledgeLogo subtitle="Приватная рабочая база команды" />

          <div className="mt-10 space-y-5">
            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
              One flow login
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Вход в рабочую базу за минуту.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Один экран для входа, регистрации и восстановления пароля. После авторизации вы
              сразу попадаете в трек работы со статьями.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <NotebookTabs className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Четкая структура</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Темы, категории и статьи организованы так, чтобы информация искалась быстрее.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <BookOpenText className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Чтение и редактирование</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Открываете статью и сразу работаете с содержимым без лишних переходов.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:col-span-2 xl:col-span-1">
              <div className="flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Контроль доступа</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Подтверждение почты и заявки на доступ проходят через админ-модерацию.
              </p>
            </article>
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Clock3 className="size-4 text-sky-700" />
              Авторизация обычно занимает меньше минуты
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Нужный сценарий выбирается сразу в форме справа: вход, регистрация или сброс пароля.
            </p>
          </div>
        </section>

        <section className="flex items-start lg:items-stretch">
          <AuthForms />
        </section>
      </main>
    </div>
  );
}
