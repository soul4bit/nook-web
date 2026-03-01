import { LockKeyhole, ShieldCheck } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
    error?: string;
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <main className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1480px] overflow-hidden rounded-[32px] border border-slate-700/80 bg-[#0a131c]/95 shadow-[0_40px_120px_rgba(2,8,15,0.75)] lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
        <section className="flex flex-col justify-between border-b border-slate-700/80 bg-[#0f1b27]/90 p-6 lg:border-b-0 lg:border-r lg:p-8 xl:p-10">
          <div>
            <KnowledgeLogo subtitle="Сброс доступа" />
            <span className="mt-6 inline-flex rounded-full border border-[#2f4356] bg-[#132231] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#71a1c2]">
              password reset
            </span>
            <div className="mt-8 space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl lg:text-6xl">
                Новый пароль без лишних шагов.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
                Ссылка из письма ведет сразу на форму смены пароля. После сохранения вы
                возвращаетесь ко входу и продолжаете работу в Контуре Знаний.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[22px] border border-slate-700/70 bg-[#111f2c]/85 p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#193246] text-[#49d4b8]">
                <LockKeyhole className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-100">Одноразовая ссылка</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Письмо ведет на этот экран и быстро истекает, чтобы восстановление оставалось
                безопасным.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-700/70 bg-[#111f2c]/85 p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#193246] text-[#49d4b8]">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-100">Возврат ко входу</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                После смены пароля можно сразу зайти под своим аккаунтом и продолжить работу со
                статьями.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center p-5 lg:p-8 xl:p-10">
          <ResetPasswordForm token={params.token ?? null} error={params.error ?? null} />
        </section>
      </main>
    </div>
  );
}
