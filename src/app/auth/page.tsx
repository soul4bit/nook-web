import { redirect } from "next/navigation";
import { BookOpenText, NotebookTabs, ShieldCheck } from "lucide-react";
import { AuthForms } from "@/components/auth/auth-forms";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AuthPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-[#121514] px-4 py-4 text-[#f3f7f4] sm:px-6 lg:px-8">
      <main className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1480px] overflow-hidden rounded-[36px] border border-[#29312d] bg-[radial-gradient(circle_at_top_left,rgba(83,230,166,0.16),transparent_28%),linear-gradient(180deg,#181c1a_0%,#111413_100%)] shadow-[0_30px_120px_rgba(0,0,0,0.45)] lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
        <section className="flex flex-col justify-between border-b border-[#29312d] p-6 lg:border-b-0 lg:border-r lg:p-8 xl:p-10">
          <div>
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-20 items-center justify-center overflow-hidden rounded-[22px] border border-[#31413a] bg-[#0f1311]">
                <div className="absolute left-2 h-3 w-2 rounded-full bg-[#53e6a6]" />
                <div className="absolute left-6 top-4 h-7 w-4 rounded-l-[20px] rounded-r-[6px] bg-[#53e6a6]" />
                <div className="absolute left-8 top-2 h-10 w-3 rotate-[32deg] rounded-full bg-[#53e6a6]" />
                <div className="absolute right-6 top-4 h-7 w-4 rounded-l-[6px] rounded-r-[20px] bg-[#53e6a6]" />
                <div className="absolute right-2 h-3 w-2 rounded-full bg-[#53e6a6]" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-[#6d8379]">
                  Контур Знаний
                </p>
                <p className="text-sm text-[#d7e2dc]">Личный вход в базу знаний</p>
              </div>
            </div>

            <div className="mt-12 space-y-5">
              <span className="inline-flex rounded-full border border-[#31413a] bg-[#171c19] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#91b4a3]">
                auth
              </span>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Вход в «Контур Знаний» без лишнего шума.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[#8fa59c] sm:text-lg">
                Один спокойный экран для входа, регистрации и восстановления
                доступа. После авторизации ты сразу попадаешь к своим статьям и
                заметкам по DevOps-направлениям.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[28px] border border-[#29312d] bg-[#171c19] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#111513] text-[#53e6a6]">
                <NotebookTabs className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">Твои статьи</h2>
              <p className="mt-2 text-sm leading-7 text-[#8fa59c]">
                Linux, Docker, сети, Terraform и остальные разделы собраны в одной
                структуре.
              </p>
            </div>

            <div className="rounded-[28px] border border-[#29312d] bg-[#171c19] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#111513] text-[#53e6a6]">
                <BookOpenText className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">Чтение рядом</h2>
              <p className="mt-2 text-sm leading-7 text-[#8fa59c]">
                Статья открывается сразу рядом с редактором, без прыжков между
                разными экранами.
              </p>
            </div>

            <div className="rounded-[28px] border border-[#29312d] bg-[#171c19] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#111513] text-[#53e6a6]">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">Надежный доступ</h2>
              <p className="mt-2 text-sm leading-7 text-[#8fa59c]">
                Аккаунты и сессии живут в PostgreSQL, а подтверждение почты и
                сброс пароля уже подключены.
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
