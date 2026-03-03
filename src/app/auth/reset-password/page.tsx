import { KeyRound, ShieldCheck } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
    error?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <main className="mx-auto grid w-full max-w-[1240px] gap-5 lg:grid-cols-[1fr_minmax(430px,0.95fr)]">
        <section className="nook-shell rounded-3xl p-6 sm:p-8">
          <KnowledgeLogo subtitle="вернем доступ без нервов" />

          <div className="mt-8 space-y-4">
            <span className="nook-kicker">recovery mode</span>
            <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              Обновите пароль и снова в бой
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Ссылка из письма открывает одноразовую форму. Меняете пароль и возвращаетесь в рабочую
              вики без квестов.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <article className="nook-panel rounded-2xl p-4">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border-2 border-border bg-accent text-foreground">
                <ShieldCheck className="size-4" />
              </div>
              <h2 className="mt-3 text-sm font-semibold text-foreground">Одноразовый токен</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                Сброс работает только по валидной ссылке и не живет вечно.
              </p>
            </article>
            <article className="nook-panel rounded-2xl p-4">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border-2 border-border bg-accent text-foreground">
                <KeyRound className="size-4" />
              </div>
              <h2 className="mt-3 text-sm font-semibold text-foreground">Новый пароль</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                Задайте новый пароль и используйте его для следующего входа.
              </p>
            </article>
          </div>
        </section>

        <section className="nook-shell rounded-3xl p-6 sm:p-8">
          <ResetPasswordForm token={params.token ?? null} error={params.error ?? null} />
        </section>
      </main>
    </div>
  );
}
