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
    <div className="min-h-screen bg-[#edf1f4] px-3 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto grid max-w-[1560px] gap-4 lg:grid-cols-[1.05fr_minmax(420px,0.95fr)]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:p-9 xl:p-10">
          <KnowledgeLogo subtitle="Безопасное восстановление доступа" />
          <span className="mt-8 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
            Password reset
          </span>

          <div className="mt-8 space-y-5">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Обновите пароль и вернитесь к работе.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Ссылка из письма открывает защищенную форму смены пароля. После сохранения вы
              сможете сразу войти в Контур Знаний с новыми данными.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <LockKeyhole className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Одноразовая ссылка</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Ссылка имеет ограниченный срок действия и защищает восстановление аккаунта от
                повторного использования.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Быстрый возврат</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                После смены пароля вы возвращаетесь к экрану входа и продолжаете работу без
                дополнительной настройки.
              </p>
            </article>
          </div>
        </section>

        <section className="flex items-start lg:items-stretch">
          <ResetPasswordForm token={params.token ?? null} error={params.error ?? null} />
        </section>
      </main>
    </div>
  );
}
