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
    <div className="min-h-screen bg-[#121514] px-4 py-4 text-[#f3f7f4] sm:px-6 lg:px-8">
      <main className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1480px] overflow-hidden rounded-[36px] border border-[#29312d] bg-[radial-gradient(circle_at_top_left,rgba(83,230,166,0.16),transparent_28%),linear-gradient(180deg,#181c1a_0%,#111413_100%)] shadow-[0_30px_120px_rgba(0,0,0,0.45)] lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
        <section className="flex flex-col justify-between border-b border-[#29312d] p-6 lg:border-b-0 lg:border-r lg:p-8 xl:p-10">
          <div>
            <span className="inline-flex rounded-full border border-[#31413a] bg-[#171c19] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#91b4a3]">
              password reset
            </span>
            <div className="mt-8 space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Новый пароль без лишних шагов.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[#8fa59c] sm:text-lg">
                Ссылка из письма ведет сразу на экран смены пароля. После
                сохранения ты возвращаешься ко входу и продолжаешь работу в «Контур Знаний».
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] border border-[#29312d] bg-[#171c19] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#111513] text-[#53e6a6]">
                <LockKeyhole className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">Одноразовая ссылка</h2>
              <p className="mt-2 text-sm leading-7 text-[#8fa59c]">
                Письмо ведет на этот экран и быстро истекает, чтобы восстановление
                было безопасным.
              </p>
            </div>

            <div className="rounded-[28px] border border-[#29312d] bg-[#171c19] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#111513] text-[#53e6a6]">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">Возврат к входу</h2>
              <p className="mt-2 text-sm leading-7 text-[#8fa59c]">
                Как только пароль сохранен, можно сразу входить под своим
                аккаунтом и возвращаться к статьям.
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
