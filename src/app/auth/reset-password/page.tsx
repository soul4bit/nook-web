import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
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
    <div className="min-h-screen px-3 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto grid w-full max-w-[1480px] gap-4 lg:grid-cols-[1.1fr_minmax(440px,0.9fr)]">
        <section className="nook-shell rounded-[32px] p-6 lg:p-9 xl:p-10">
          <KnowledgeLogo subtitle="Безопасное восстановление доступа" />

          <div className="mt-9 space-y-5">
            <span className="nook-kicker">
              <LockKeyhole className="size-3.5" />
              Password reset
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.35rem] lg:leading-[1.07]">
              Обновите пароль и вернитесь к работе.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">
              Ссылка из письма открывает защищенную форму смены пароля. После сохранения вы сразу
              сможете войти в Контур Знаний с новыми данными.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.045)]">
              <div className="flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <KeyRound className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Одноразовая ссылка</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Ссылка действует ограниченное время и защищает восстановление от повторного
                использования.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.045)]">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Безопасный возврат</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                После смены пароля вы возвращаетесь к стандартному входу без дополнительной
                настройки.
              </p>
            </article>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
            <h2 className="text-sm font-semibold text-slate-800">Как проходит восстановление</h2>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
              <li className="flex items-start gap-2.5">
                <ArrowRight className="mt-1 size-4 text-sky-600" />
                Открываете ссылку из письма и задаете новый пароль.
              </li>
              <li className="flex items-start gap-2.5">
                <ArrowRight className="mt-1 size-4 text-sky-600" />
                Система проверяет требования к паролю и сохраняет изменения.
              </li>
              <li className="flex items-start gap-2.5">
                <ArrowRight className="mt-1 size-4 text-sky-600" />
                Возвращаетесь на экран входа и продолжаете работу.
              </li>
            </ul>
          </div>
        </section>

        <section className="flex items-start lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:items-stretch">
          <ResetPasswordForm token={params.token ?? null} error={params.error ?? null} />
        </section>
      </main>
    </div>
  );
}
