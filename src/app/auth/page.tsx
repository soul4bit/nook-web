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
            markClassName="border-[#3a6585] bg-[#102942]"
            titleClassName="text-[#a6d8ee]"
            subtitleClassName="text-[#7db0cc]"
          />

          <div className="relative z-10 mt-8 lg:mt-6">
            <div className="rounded-3xl border border-[#335f7f] bg-[#102a42]/78 p-5 shadow-[0_20px_44px_rgba(2,8,16,0.42)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7fc5e4]">О Wiki</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#e6f3fd]">
                Единая база знаний команды
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#9fc2d8]">
                Документация, runbook и статьи в одном месте. Доступы настраиваются по ролям, а
                контент можно быстро обновлять и поддерживать в актуальном состоянии.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="nook-chip">Быстрый поиск</span>
                <span className="nook-chip">Права по ролям</span>
                <span className="nook-chip">История изменений</span>
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
