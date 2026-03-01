import { redirect } from "next/navigation";
import { BookOpenText, NotebookTabs, ShieldCheck } from "lucide-react";
import { AuthForms } from "@/components/auth/auth-forms";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AuthPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1480px] overflow-hidden rounded-[32px] border border-slate-300 bg-[#e9edf3]/96 shadow-[0_30px_90px_rgba(15,23,42,0.12)] lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
        <section className="flex flex-col justify-between border-b border-slate-300 bg-[#dde5ee] p-6 lg:border-b-0 lg:border-r lg:p-8 xl:p-10">
          <div>
            <KnowledgeLogo subtitle="Вход в личную базу знаний" />

            <div className="mt-12 space-y-5">
              <span className="inline-flex rounded-full border border-[#9fb8c9] bg-[#edf2f7] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3d6178]">
                auth
              </span>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Вход и регистрация без лишних шагов.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Один экран для входа, регистрации и восстановления пароля. После авторизации вы
                сразу попадаете в свои статьи и можете продолжать работу.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[22px] border border-slate-300 bg-[#f3f6fa] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#dbeaf4] text-[#3b82a4]">
                <NotebookTabs className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Статьи по темам</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Linux, Docker, сети, Terraform и другие разделы собраны в единой структуре.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-300 bg-[#f3f6fa] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#dbeaf4] text-[#3b82a4]">
                <BookOpenText className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Чтение рядом</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Выбираете статью в списке и сразу видите контент, без переходов по отдельным
                страницам.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-300 bg-[#f3f6fa] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#dbeaf4] text-[#3b82a4]">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Надежный доступ</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Аккаунты и сессии хранятся в PostgreSQL, подтверждение email и сброс пароля уже
                подключены.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center p-5 lg:p-8 xl:p-10">
          <AuthForms />
        </section>
      </main>
    </div>
  );
}


