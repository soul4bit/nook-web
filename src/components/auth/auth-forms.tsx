"use client";

import { type ComponentProps, type FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, LoaderCircle, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  extractAuthErrorMessage,
  getAuthErrorMessage,
  getQueryAuthFeedback,
  type AuthFeedback,
} from "@/lib/auth/messages";

type AuthMode = "sign-in" | "sign-up" | "reset";
type PendingAction = "sign-in" | "sign-up" | "reset" | "resend" | null;
type GuardAction = "sign-in" | "sign-up" | "reset" | "resend";
type GuardState = {
  startedAt: number;
  website: string;
};

type AuthSuccessResponse = {
  status?: string;
  message?: string;
};

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

  return (result ?? {}) as AuthSuccessResponse;
}

function getAbsoluteUrl(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function createGuardState(): GuardState {
  return {
    startedAt: Date.now(),
    website: "",
  };
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

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-slate-300">
      {children}
    </label>
  );
}

function FormInput(props: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={`h-12 rounded-2xl border-slate-700/80 bg-[#0f1b28] text-slate-100 placeholder:text-slate-500 ${props.className ?? ""}`}
    />
  );
}

function BotTrap({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="text"
      name="website"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden opacity-0"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function AuthForms() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFeedback = useMemo(() => getQueryAuthFeedback(searchParams), [searchParams]);
  const requestedMode = searchParams.get("mode");

  const [mode, setMode] = useState<AuthMode>(
    requestedMode === "sign-up" || requestedMode === "reset" ? requestedMode : "sign-in"
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [guardState, setGuardState] = useState<Record<GuardAction, GuardState>>({
    "sign-in": createGuardState(),
    "sign-up": createGuardState(),
    reset: createGuardState(),
    resend: createGuardState(),
  });
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [resetEmail, setResetEmail] = useState("");

  const activeFeedback = feedback ?? queryFeedback;
  const resendEmail = lastEmail || signInForm.email || signUpForm.email || resetEmail;
  const title =
    mode === "sign-in"
      ? "Вход"
      : mode === "sign-up"
        ? "Регистрация"
        : "Сброс пароля";
  const description =
    mode === "sign-in"
      ? "Введите email и пароль, чтобы открыть рабочую область."
      : mode === "sign-up"
        ? "Оставьте заявку на доступ. Администратор проверит ее в Telegram и отправит решение на почту."
        : "Отправим письмо со ссылкой для безопасного сброса пароля.";

  function updateGuard(action: GuardAction, patch: Partial<GuardState>) {
    setGuardState((current) => ({
      ...current,
      [action]: {
        ...current[action],
        ...patch,
      },
    }));
  }

  function resetGuard(action: GuardAction) {
    setGuardState((current) => ({
      ...current,
      [action]: createGuardState(),
    }));
  }

  function openMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFeedback(null);
    setAwaitingVerification(false);
    if (nextMode === "sign-in") {
      resetGuard("sign-in");
    }
    if (nextMode === "sign-up") {
      resetGuard("sign-up");
    }
    if (nextMode === "reset") {
      resetGuard("reset");
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = signInForm.email.trim();
    const password = signInForm.password;

    if (!email || !password) {
      setFeedback({ tone: "error", text: "Введите email и пароль." });
      return;
    }

    setPendingAction("sign-in");
    setFeedback(null);

    try {
      await postAuth("/api/auth-guard/sign-in", {
        email,
        password,
        ...guardState["sign-in"],
      });
      router.replace("/app");
      router.refresh();
    } catch (error) {
      const message = extractAuthErrorMessage(error);

      if (message === "Email not verified") {
        setAwaitingVerification(true);
        setLastEmail(email);
        setFeedback({
          tone: "info",
          text: "Почта еще не подтверждена. Запросите письмо повторно и активируйте аккаунт.",
        });
      } else {
        setFeedback({ tone: "error", text: getAuthErrorMessage(message) });
      }
    } finally {
      setPendingAction(null);
      resetGuard("sign-in");
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = signUpForm.name.trim();
    const email = signUpForm.email.trim();
    const password = signUpForm.password;
    const confirmPassword = signUpForm.confirmPassword;

    if (!name || !email || !password || !confirmPassword) {
      setFeedback({ tone: "error", text: "Заполните имя, email и пароль." });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ tone: "error", text: "Пароли не совпадают." });
      return;
    }

    if (password.length < 10 || !/\p{L}/u.test(password) || !/\d/.test(password)) {
      setFeedback({
        tone: "error",
        text: "Пароль должен быть от 10 до 128 символов и содержать буквы и цифры.",
      });
      return;
    }

    setPendingAction("sign-up");
    setFeedback(null);
    setAwaitingVerification(false);

    try {
      const result = await postAuth("/api/auth-guard/sign-up", {
        name,
        email,
        password,
        callbackURL: getAbsoluteUrl("/app"),
        ...guardState["sign-up"],
      });

      setLastEmail(email);
      setMode("sign-in");
      setSignInForm({ email, password: "" });
      setSignUpForm({ name: "", email: "", password: "", confirmPassword: "" });
      setFeedback({
        tone: "success",
        text:
          result.message ??
          "Заявка на регистрацию отправлена администратору в Telegram. После одобрения вы сможете войти.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: getAuthErrorMessage(extractAuthErrorMessage(error)),
      });
    } finally {
      setPendingAction(null);
      resetGuard("sign-up");
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = resetEmail.trim();

    if (!email) {
      setFeedback({ tone: "error", text: "Введите email, на который отправить ссылку." });
      return;
    }

    setPendingAction("reset");
    setFeedback(null);

    try {
      await postAuth("/api/auth-guard/request-password-reset", {
        email,
        redirectTo: getAbsoluteUrl("/auth/reset-password"),
        ...guardState.reset,
      });
      setLastEmail(email);
      setFeedback({
        tone: "info",
        text: `Если адрес ${email} есть в системе, мы отправили письмо для сброса пароля.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: getAuthErrorMessage(extractAuthErrorMessage(error)),
      });
    } finally {
      setPendingAction(null);
      resetGuard("reset");
    }
  }

  async function handleResendVerification() {
    const email = resendEmail.trim();

    if (!email) {
      setFeedback({
        tone: "error",
        text: "Сначала укажите email, на который нужно отправить письмо.",
      });
      return;
    }

    setPendingAction("resend");
    setFeedback(null);

    try {
      await postAuth("/api/auth-guard/send-verification-email", {
        email,
        callbackURL: getAbsoluteUrl("/app"),
        ...guardState.resend,
      });
      setAwaitingVerification(true);
      setLastEmail(email);
      setFeedback({ tone: "success", text: `Новое письмо отправлено на ${email}.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: getAuthErrorMessage(extractAuthErrorMessage(error)),
      });
    } finally {
      setPendingAction(null);
      resetGuard("resend");
    }
  }

  return (
    <div className="w-full rounded-[28px] border border-slate-700/80 bg-[#132230]/85 p-5 shadow-[0_30px_90px_rgba(2,8,15,0.45)] sm:p-6">
      <div className="border-b border-slate-700/80 pb-6">
        <div className="inline-flex rounded-full border border-slate-700/80 bg-[#172a3b] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {mode === "sign-in" ? "вход" : mode === "sign-up" ? "заявка" : "сброс"}
        </div>
        <div className="mt-4 space-y-2">
          <h2 className="text-2xl font-semibold text-slate-100">{title}</h2>
          <p className="max-w-md text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>

      <div className="space-y-5 pt-6">
        {activeFeedback ? <FeedbackBanner feedback={activeFeedback} /> : null}

        {awaitingVerification ? (
          <div className="rounded-[20px] border border-cyan-500/40 bg-cyan-950/30 p-4 text-sm leading-6 text-cyan-200">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-[#0f1b28] text-[#56e3c2]">
                <Mail className="size-4" />
              </div>
              <div className="space-y-3">
                <p>
                  Подтвердите email <strong>{resendEmail || "вашего аккаунта"}</strong>, чтобы
                  завершить активацию.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-slate-600/70 bg-[#0f1b28] text-slate-200 hover:bg-[#18293b]"
                  onClick={handleResendVerification}
                  disabled={pendingAction === "resend"}
                >
                  {pendingAction === "resend" ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Отправляем письмо...
                    </>
                  ) : (
                    <>
                      <Mail className="size-4" />
                      Отправить письмо еще раз
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {mode === "sign-in" ? (
          <>
            <form className="space-y-4" onSubmit={handleSignIn}>
              <BotTrap
                value={guardState["sign-in"].website}
                onChange={(value) => updateGuard("sign-in", { website: value })}
              />

              <div className="space-y-1.5">
                <FieldLabel htmlFor="signin-email">Email</FieldLabel>
                <FormInput
                  id="signin-email"
                  name="email"
                  type="email"
                  value={signInForm.email}
                  onChange={(event) =>
                    setSignInForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="signin-password">Пароль</FieldLabel>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#56e3c2] hover:text-[#87efd7]"
                    onClick={() => {
                      openMode("reset");
                      setResetEmail(signInForm.email);
                    }}
                  >
                    Забыли пароль?
                  </button>
                </div>
                <FormInput
                  id="signin-password"
                  name="password"
                  type="password"
                  value={signInForm.password}
                  onChange={(event) =>
                    setSignInForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-2xl bg-[#21ab8f] text-white hover:bg-[#1b947d]"
                disabled={pendingAction === "sign-in"}
              >
                {pendingAction === "sign-in" ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Входим...
                  </>
                ) : (
                  <>
                    <KeyRound className="size-4" />
                    Войти
                  </>
                )}
              </Button>
            </form>

            <div className="rounded-[20px] border border-slate-700/80 bg-[#152638] p-4">
              <p className="text-sm font-medium text-slate-100">Нет аккаунта?</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Отправьте заявку, и после одобрения вам придет письмо с подтверждением доступа.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full rounded-2xl border-slate-600/70 bg-[#0f1b28] text-slate-200 hover:bg-[#18293b]"
                onClick={() => {
                  openMode("sign-up");
                  setSignUpForm((current) => ({
                    ...current,
                    email: signInForm.email || current.email,
                  }));
                }}
              >
                <UserPlus className="size-4" />
                Перейти к регистрации
              </Button>
            </div>
          </>
        ) : null}

        {mode === "sign-up" ? (
          <>
            <form className="space-y-4" onSubmit={handleSignUp}>
              <BotTrap
                value={guardState["sign-up"].website}
                onChange={(value) => updateGuard("sign-up", { website: value })}
              />

              <div className="space-y-1.5">
                <FieldLabel htmlFor="signup-name">Имя</FieldLabel>
                <FormInput
                  id="signup-name"
                  name="name"
                  value={signUpForm.name}
                  onChange={(event) =>
                    setSignUpForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Как к вам обращаться"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                <FormInput
                  id="signup-email"
                  name="email"
                  type="email"
                  value={signUpForm.email}
                  onChange={(event) =>
                    setSignUpForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="signup-password">Пароль</FieldLabel>
                  <FormInput
                    id="signup-password"
                    name="password"
                    type="password"
                    value={signUpForm.password}
                    onChange={(event) =>
                      setSignUpForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Минимум 10 символов"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="signup-password-repeat">Повторите пароль</FieldLabel>
                  <FormInput
                    id="signup-password-repeat"
                    name="confirmPassword"
                    type="password"
                    value={signUpForm.confirmPassword}
                    onChange={(event) =>
                      setSignUpForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    placeholder="Повторите пароль"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-2xl bg-[#21ab8f] text-white hover:bg-[#1b947d]"
                disabled={pendingAction === "sign-up"}
              >
                {pendingAction === "sign-up" ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Отправляем заявку...
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4" />
                    Отправить запрос
                  </>
                )}
              </Button>
            </form>

            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-2xl text-slate-400 hover:bg-[#18293b] hover:text-slate-100"
              onClick={() => {
                openMode("sign-in");
                setSignInForm((current) => ({
                  ...current,
                  email: signUpForm.email || current.email,
                }));
              }}
            >
              <ArrowLeft className="size-4" />
              Уже есть аккаунт? Вернуться ко входу
            </Button>
          </>
        ) : null}

        {mode === "reset" ? (
          <>
            <form className="space-y-4" onSubmit={handleReset}>
              <BotTrap
                value={guardState.reset.website}
                onChange={(value) => updateGuard("reset", { website: value })}
              />

              <div className="space-y-1.5">
                <FieldLabel htmlFor="reset-email">Email для восстановления</FieldLabel>
                <FormInput
                  id="reset-email"
                  name="email"
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-2xl bg-[#21ab8f] text-white hover:bg-[#1b947d]"
                disabled={pendingAction === "reset"}
              >
                {pendingAction === "reset" ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Отправляем ссылку...
                  </>
                ) : (
                  <>
                    <Mail className="size-4" />
                    Отправить ссылку
                  </>
                )}
              </Button>
            </form>

            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-2xl text-slate-400 hover:bg-[#18293b] hover:text-slate-100"
              onClick={() => {
                openMode("sign-in");
                setSignInForm((current) => ({
                  ...current,
                  email: resetEmail || current.email,
                }));
              }}
            >
              <ArrowLeft className="size-4" />
              Вернуться ко входу
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
