"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  extractAuthErrorMessage,
  getAuthErrorMessage,
  type AuthFeedback,
} from "@/lib/auth/messages";

async function postAuth(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let result: unknown = null;

  if (rawText) {
    try {
      result = JSON.parse(rawText);
    } catch {
      result = { message: rawText };
    }
  }

  if (!response.ok) {
    throw new Error(extractAuthErrorMessage(result) ?? `HTTP_${response.status}`);
  }

  return result;
}

function FeedbackBanner({ feedback }: { feedback: AuthFeedback }) {
  const toneClass =
    feedback.tone === "error"
      ? "border-rose-500/40 bg-rose-950/40 text-rose-300"
      : feedback.tone === "success"
        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
        : "border-cyan-500/40 bg-cyan-950/30 text-cyan-300";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${toneClass}`}>
      {feedback.text}
    </div>
  );
}

type ResetPasswordFormProps = {
  token: string | null;
  error: string | null;
};

export function ResetPasswordForm({ token, error }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [website, setWebsite] = useState("");

  const invalidLink = !token || error === "INVALID_TOKEN";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setFeedback({
        tone: "error",
        text: "Ссылка для сброса недействительна.",
      });
      return;
    }

    if (!password || !confirmPassword) {
      setFeedback({
        tone: "error",
        text: "Введите новый пароль и повторите его.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({
        tone: "error",
        text: "Пароли не совпадают.",
      });
      return;
    }

    if (password.length < 10 || !/\p{L}/u.test(password) || !/\d/.test(password)) {
      setFeedback({
        tone: "error",
        text: "Пароль должен быть от 10 до 128 символов и содержать буквы и цифры.",
      });
      return;
    }

    setIsPending(true);
    setFeedback(null);

    try {
      await postAuth("/api/auth-guard/reset-password", {
        token,
        newPassword: password,
        startedAt,
        website,
      });

      router.replace("/auth?mode=sign-in&reset=success");
      router.refresh();
    } catch (submitError) {
      setFeedback({
        tone: "error",
        text: getAuthErrorMessage(extractAuthErrorMessage(submitError)),
      });
    } finally {
      setIsPending(false);
      setStartedAt(Date.now());
      setWebsite("");
    }
  }

  return (
    <div className="w-full rounded-[28px] border border-slate-700/80 bg-[#132230]/85 p-5 shadow-[0_30px_90px_rgba(2,8,15,0.45)] sm:p-6">
      <div className="border-b border-slate-700/80 pb-6">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#1a3348] text-[#56e3c2]">
          <KeyRound className="size-5" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-slate-100">Новый пароль</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
          Укажите новый пароль для аккаунта и вернитесь к обычному входу.
        </p>
      </div>

      <div className="space-y-5 pt-6">
        {feedback ? <FeedbackBanner feedback={feedback} /> : null}

        {invalidLink ? (
          <div className="space-y-4">
            <FeedbackBanner
              feedback={{
                tone: "error",
                text: "Ссылка уже недействительна. Запросите новое письмо для сброса пароля.",
              }}
            />
            <Button
              asChild
              variant="outline"
              className="w-full rounded-2xl border-slate-600/70 bg-[#0f1b28] text-slate-300 hover:bg-[#18293b]"
            >
              <Link href="/auth?mode=reset">Вернуться к форме сброса</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden opacity-0"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />

            <div className="space-y-1.5">
              <label htmlFor="reset-password" className="text-sm font-medium text-slate-300">
                Новый пароль
              </label>
              <Input
                id="reset-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Минимум 10 символов"
                className="h-12 rounded-2xl border-slate-700/80 bg-[#0f1b28] text-slate-100 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-password-confirm" className="text-sm font-medium text-slate-300">
                Повторите пароль
              </label>
              <Input
                id="reset-password-confirm"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Повторите пароль"
                className="h-12 rounded-2xl border-slate-700/80 bg-[#0f1b28] text-slate-100 placeholder:text-slate-500"
                required
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-2xl bg-[#21ab8f] text-white hover:bg-[#1b947d]"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Сохраняем пароль...
                </>
              ) : (
                "Сохранить новый пароль"
              )}
            </Button>

            <Button
              asChild
              type="button"
              variant="ghost"
              className="w-full rounded-2xl text-slate-400 hover:bg-[#18293b] hover:text-slate-100"
            >
              <Link href="/auth">
                <ArrowLeft className="size-4" />
                Назад ко входу
              </Link>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
