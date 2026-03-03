"use client";

import { type FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
} from "lucide-react";
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
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : feedback.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${toneClass}`}>{feedback.text}</div>
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [website, setWebsite] = useState("");

  const invalidLink = !token || error === "INVALID_TOKEN";

  const passwordChecks = useMemo(() => {
    const hasLetters = /\p{L}/u.test(password);
    const hasDigit = /\d/.test(password);

    return [
      {
        id: "length",
        text: "От 10 до 128 символов",
        passed: password.length >= 10 && password.length <= 128,
      },
      {
        id: "letters",
        text: "Содержит буквы",
        passed: hasLetters,
      },
      {
        id: "digits",
        text: "Содержит цифры",
        passed: hasDigit,
      },
      {
        id: "match",
        text: "Пароли совпадают",
        passed: confirmPassword.length > 0 && password === confirmPassword,
      },
    ];
  }, [confirmPassword, password]);

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

    if (
      password.length < 10 ||
      password.length > 128 ||
      !/\p{L}/u.test(password) ||
      !/\d/.test(password)
    ) {
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
    <div className="w-full rounded-[32px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6 lg:h-full lg:overflow-y-auto nook-scroll">
      <div className="space-y-4 border-b border-slate-200 pb-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <span className="nook-kicker">безопасная смена пароля</span>
          <div className="mt-3 flex items-start gap-3">
            <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <KeyRound className="size-4" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Новый пароль</h2>
              <p className="text-sm leading-6 text-slate-600">
                Задайте новый пароль для аккаунта и вернитесь к обычному входу.
              </p>
            </div>
          </div>
        </div>
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
              className="h-11 w-full rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
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
              <label htmlFor="reset-password" className="text-sm font-medium text-slate-700">
                Новый пароль
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="reset-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Минимум 10 символов"
                  className="h-12 rounded-xl border-slate-300 bg-white pl-11 pr-12 text-slate-900 placeholder:text-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-password-confirm" className="text-sm font-medium text-slate-700">
                Повторите пароль
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="reset-password-confirm"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Повторите пароль"
                  className="h-12 rounded-xl border-slate-300 bg-white pl-11 pr-12 text-slate-900 placeholder:text-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label={showConfirmPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Требования к паролю
              </p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {passwordChecks.map((check) => (
                  <div key={check.id} className="flex items-center gap-2 text-sm text-slate-600">
                    {check.passed ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <Circle className="size-4 text-slate-400" />
                    )}
                    {check.text}
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={isPending}>
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
              className="w-full rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
