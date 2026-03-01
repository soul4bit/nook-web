import { LockKeyhole, ShieldCheck } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

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
    <div className="min-h-screen px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1480px] overflow-hidden rounded-[32px] border border-slate-200 bg-[#f7f9fb]/95 shadow-[0_24px_90px_rgba(15,23,42,0.08)] lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
        <section className="flex flex-col justify-between border-b border-slate-200 bg-[#f2f6fa] p-6 lg:border-b-0 lg:border-r lg:p-8 xl:p-10">
          <div>
            <span className="inline-flex rounded-full border border-[#bfd3df] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#4c7390]">
              password reset
            </span>
            <div className="mt-8 space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Новый пароль без лишних шагов.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Ссылка из письма ведет сразу на форму смены пароля. После сохранения вы
                возвращаетесь ко входу и продолжаете работу в Контуре Знаний.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-white p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#dbeaf4] text-[#3b82a4]">
                <LockKeyhole className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Одноразовая ссылка</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Письмо ведет на этот экран и быстро истекает, чтобы восстановление оставалось
                безопасным.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-white p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#dbeaf4] text-[#3b82a4]">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Возврат ко входу</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
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
