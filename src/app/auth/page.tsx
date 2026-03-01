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
    <div className="min-h-screen px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <main className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1480px] overflow-hidden rounded-[32px] border border-slate-700/80 bg-[#0a131c]/95 shadow-[0_40px_120px_rgba(2,8,15,0.75)] lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
        <section className="flex flex-col justify-between border-b border-slate-700/80 bg-[#0f1b27]/90 p-6 lg:border-b-0 lg:border-r lg:p-8 xl:p-10">
          <div>
            <KnowledgeLogo subtitle="Вход в личную базу знаний" />

            <div className="mt-12 space-y-5">
              <span className="inline-flex rounded-full border border-[#2f4356] bg-[#132231] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#71a1c2]">
                auth
              </span>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl lg:text-6xl">
                Вход и регистрация без лишних шагов.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
                Один экран для входа, регистрации и восстановления пароля. После авторизации вы
                сразу попадаете в свои статьи и можете продолжать работу.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[22px] border border-slate-700/70 bg-[#111f2c]/85 p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#193246] text-[#49d4b8]">
                <NotebookTabs className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-100">Статьи по темам</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Linux, Docker, сети, Terraform и другие разделы собраны в единой структуре.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-700/70 bg-[#111f2c]/85 p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#193246] text-[#49d4b8]">
                <BookOpenText className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-100">Чтение рядом</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Выбираете статью в списке и сразу видите контент, без переходов по отдельным
                страницам.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-700/70 bg-[#111f2c]/85 p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#193246] text-[#49d4b8]">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-100">Надежный доступ</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
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


