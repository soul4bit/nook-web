import { redirect } from "next/navigation";
import { AuthForms } from "@/components/auth/auth-forms";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AuthPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen px-3 py-4 text-slate-100 sm:px-6 lg:px-8">
      <main className="mx-auto grid w-full max-w-[1480px] gap-4 lg:grid-cols-[1.1fr_minmax(440px,0.9fr)]">
        <section className="nook-shell relative overflow-hidden rounded-[32px] p-6 lg:p-9 xl:p-10">
          <KnowledgeLogo
            subtitle="Приватная база знаний команды"
            className="relative z-10"
            markClassName="border-[#3f5f78] bg-[#112437]"
            titleClassName="text-[#c6e5f7]"
            subtitleClassName="text-[#8fb1c9]"
          />

          <div className="relative z-10 mt-8 lg:mt-6">
            <div className="rounded-3xl border border-[#395773] bg-[#101f30]/82 p-5 shadow-[0_20px_44px_rgba(2,8,16,0.38)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#77b8d8]">О Wiki</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#e3f1fb]">
                Единая база знаний команды
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#9db9cb]">
                Документация, runbook и статьи в одном месте. Доступы настраиваются по ролям, а
                контент можно быстро обновлять и поддерживать в актуальном состоянии.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="nook-chip">Быстрый поиск</span>
                <span className="nook-chip">Права по ролям</span>
                <span className="nook-chip">История изменений</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#324e67] bg-[#0f1d2d]/76 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#84b6d2]">
                  Что внутри
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-[#acc4d6]">
                  <li>Runbook и эксплуатационные инструкции</li>
                  <li>Архитектура сервисов и интеграций</li>
                  <li>Статьи команды и onboarding</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#324e67] bg-[#0f1d2d]/76 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#84b6d2]">
                  Рабочий процесс
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-[#acc4d6]">
                  <li>Создали статью</li>
                  <li>Проверили и обновили</li>
                  <li>Быстро нашли через поиск</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-start lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:items-stretch">
          <AuthForms />
        </section>
      </main>
    </div>
  );
}
