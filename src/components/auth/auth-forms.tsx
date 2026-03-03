"use client";

import {
  type CSSProperties,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
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

type ModeOption = {
  id: AuthMode;
  label: string;
  caption: string;
  icon: LucideIcon;
};

type ModeMeta = {
  badge: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type JourneyTone = "sky" | "amber" | "emerald" | "cyan";

type JourneyStep = {
  id: string;
  label: string;
  icon: LucideIcon;
  tone: JourneyTone;
};

type ModeJourney = {
  title: string;
  steps: JourneyStep[];
};

type JourneyState = {
  completed: boolean[];
  activeIndex: number;
  completionCount: number;
  caption: string;
};

const modeOptions: ModeOption[] = [
  {
    id: "sign-in",
    label: "Вход",
    caption: "Для действующего аккаунта",
    icon: KeyRound,
  },
  {
    id: "sign-up",
    label: "Регистрация",
    caption: "Заявка на новый доступ",
    icon: UserPlus,
  },
  {
    id: "reset",
    label: "Сброс",
    caption: "Если забыли пароль",
    icon: ShieldCheck,
  },
];

const modeMeta: Record<AuthMode, ModeMeta> = {
  "sign-in": {
    badge: "быстрый вход",
    title: "Вход в систему",
    description: "Почта и пароль. Больше ничего.",
    icon: KeyRound,
  },
  "sign-up": {
    badge: "новый доступ",
    title: "Регистрация",
    description: "Заполните форму и отправьте заявку.",
    icon: UserPlus,
  },
  reset: {
    badge: "восстановление",
    title: "Сброс пароля",
    description: "Пришлем ссылку для восстановления доступа.",
    icon: ShieldCheck,
  },
};

const modeJourney: Record<AuthMode, ModeJourney> = {
  "sign-in": {
    title: "authorization flow",
    steps: [
      { id: "signin-email", label: "email", icon: Mail, tone: "sky" },
      { id: "signin-password", label: "password", icon: KeyRound, tone: "amber" },
      { id: "signin-check", label: "check", icon: ShieldCheck, tone: "emerald" },
      { id: "signin-open", label: "session", icon: CheckCircle2, tone: "cyan" },
    ],
  },
  "sign-up": {
    title: "registration flow",
    steps: [
      { id: "signup-profile", label: "profile", icon: UserPlus, tone: "sky" },
      { id: "signup-request", label: "request", icon: Clock3, tone: "amber" },
      { id: "signup-review", label: "review", icon: ShieldCheck, tone: "emerald" },
      { id: "signup-access", label: "access", icon: KeyRound, tone: "cyan" },
    ],
  },
  reset: {
    title: "reset flow",
    steps: [
      { id: "reset-request", label: "request", icon: Mail, tone: "sky" },
      { id: "reset-wait", label: "link", icon: Clock3, tone: "amber" },
      { id: "reset-update", label: "update", icon: KeyRound, tone: "emerald" },
      { id: "reset-done", label: "login", icon: CheckCircle2, tone: "cyan" },
    ],
  },
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
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : feedback.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${toneClass}`}>{feedback.text}</div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-[#c3dbee]">
      {children}
    </label>
  );
}

function FormInput(props: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={`h-12 rounded-xl border-[#345b79] bg-[#112b44] text-slate-100 placeholder:text-[#7ca1bd] ${props.className ?? ""}`}
    />
  );
}

function IconInput({
  icon: Icon,
  trailing,
  className,
  ...props
}: ComponentProps<typeof Input> & {
  icon: LucideIcon;
  trailing?: ReactNode;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7db0cc]" />
      <FormInput {...props} className={`pl-11 ${trailing ? "pr-12" : ""} ${className ?? ""}`} />
      {trailing ? (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[#b8d2e8]">{trailing}</div>
      ) : null}
    </div>
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
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    const nextMode =
      requestedMode === "sign-up" || requestedMode === "reset" ? requestedMode : "sign-in";

    setMode(nextMode);
  }, [requestedMode]);

  const activeFeedback = feedback ?? queryFeedback;
  const resendEmail = lastEmail || signInForm.email || signUpForm.email || resetEmail;
  const activeMode = modeMeta[mode];
  const activeJourney = modeJourney[mode];
  const modeOffset = mode === "sign-in" ? "0%" : mode === "sign-up" ? "100%" : "200%";
  const modeIndicatorStyle = { "--nook-mode-x": modeOffset } as CSSProperties;

  const passwordChecks = useMemo(() => {
    const hasLetters = /\p{L}/u.test(signUpForm.password);
    const hasDigit = /\d/.test(signUpForm.password);

    return [
      {
        id: "length",
        text: "От 10 до 128 символов",
        passed: signUpForm.password.length >= 10 && signUpForm.password.length <= 128,
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
        passed:
          signUpForm.confirmPassword.length > 0 && signUpForm.password === signUpForm.confirmPassword,
      },
    ];
  }, [signUpForm.confirmPassword, signUpForm.password]);

  const journeyState = useMemo<JourneyState>(() => {
    const firstIncomplete = (steps: boolean[]) => {
      const index = steps.findIndex((step) => !step);
      return index === -1 ? steps.length - 1 : index;
    };

    const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    if (mode === "sign-in") {
      const emailReady = looksLikeEmail(signInForm.email.trim());
      const passwordReady = signInForm.password.length > 0;
      const credentialsReady = emailReady && passwordReady;
      const completed = [
        emailReady,
        passwordReady,
        credentialsReady,
        pendingAction === "sign-in" ? true : credentialsReady,
      ];
      const completionCount = completed.filter(Boolean).length;

      return {
        completed,
        activeIndex: firstIncomplete(completed),
        completionCount,
        caption:
          pendingAction === "sign-in"
            ? "authorizing credentials..."
            : credentialsReady
              ? "ready to sign in"
              : "fill email and password",
      };
    }

    if (mode === "sign-up") {
      const nameReady = signUpForm.name.trim().length >= 2;
      const emailReady = looksLikeEmail(signUpForm.email.trim());
      const passwordReady =
        signUpForm.password.length >= 10 &&
        signUpForm.password.length <= 128 &&
        /\p{L}/u.test(signUpForm.password) &&
        /\d/.test(signUpForm.password);
      const confirmReady =
        signUpForm.confirmPassword.length > 0 && signUpForm.password === signUpForm.confirmPassword;
      const completed = [nameReady, emailReady, passwordReady, confirmReady];
      const completionCount = completed.filter(Boolean).length;

      let caption = "enter your name";
      if (nameReady && !emailReady) {
        caption = "enter working email";
      } else if (nameReady && emailReady && !passwordReady) {
        caption = "create strong password";
      } else if (nameReady && emailReady && passwordReady && !confirmReady) {
        caption = "confirm password";
      } else if (confirmReady) {
        caption = "ready to send request";
      }

      if (pendingAction === "sign-up") {
        caption = "sending registration request...";
      }

      return {
        completed,
        activeIndex: firstIncomplete(completed),
        completionCount,
        caption,
      };
    }

    const emailReady = looksLikeEmail(resetEmail.trim());
    const resetDone =
      mode === "reset" &&
      pendingAction !== "reset" &&
      activeFeedback?.tone === "info" &&
      Boolean(lastEmail);
    const completed = [emailReady, emailReady, pendingAction === "reset" || resetDone, resetDone];
    const completionCount = completed.filter(Boolean).length;

    return {
      completed,
      activeIndex: firstIncomplete(completed),
      completionCount,
      caption:
        resetDone
          ? "reset link sent"
          : pendingAction === "reset"
            ? "sending reset link..."
            : "enter account email",
    };
  }, [
    activeFeedback?.tone,
    lastEmail,
    mode,
    pendingAction,
    resetEmail,
    signInForm.email,
    signInForm.password,
    signUpForm.confirmPassword,
    signUpForm.email,
    signUpForm.name,
    signUpForm.password,
  ]);

  const flowStyle = {
    "--nook-flow-scale": (
      journeyState.completionCount / Math.max(activeJourney.steps.length, 1)
    ).toFixed(3),
    "--nook-flow-speed":
      mode === "sign-up" ? "2.9s" : mode === "sign-in" ? "4.4s" : "3.5s",
    "--nook-flow-glow-speed":
      mode === "sign-up" ? "2.2s" : mode === "sign-in" ? "3.3s" : "2.8s",
  } as CSSProperties;

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
      setShowSignUpPassword(false);
      setShowSignUpConfirmPassword(false);
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
    <div className="nook-auth-reveal-1 w-full rounded-[32px] border border-[#2e5674] bg-[#0d2237]/95 p-5 shadow-[0_18px_44px_rgba(3,9,18,0.45)] backdrop-blur sm:p-6 lg:h-full lg:overflow-y-auto nook-scroll">
      <div className="space-y-4 border-b border-[#2e5674] pb-6">
        <div className="nook-auth-mode-palette relative grid gap-2 sm:grid-cols-3">
          <div className="nook-auth-mode-indicator" style={modeIndicatorStyle} />
          {modeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`relative z-10 rounded-2xl border px-3 py-3 text-left transition-colors ${
                mode === option.id
                  ? "border-[#62d2f1]/30 bg-transparent text-[#d7f1ff]"
                  : "border-[#2f5774] bg-[#102941] text-[#8eb2cb] hover:border-[#4e86a9] hover:bg-[#14344f] hover:text-[#d8effd]"
              }`}
              onClick={() => {
                openMode(option.id);

                if (option.id === "sign-up") {
                  setSignUpForm((current) => ({
                    ...current,
                    email: signInForm.email || current.email,
                  }));
                }

                if (option.id === "reset") {
                  setResetEmail(signInForm.email || resetEmail);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <option.icon className="size-4" />
                <span className="text-sm font-semibold">{option.label}</span>
              </div>
              <p className="mt-1 text-xs leading-5 opacity-80">{option.caption}</p>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-[#315977] bg-[#102a42]/80 p-4">
          <span className="nook-kicker">{activeMode.badge}</span>
          <div className="mt-3 flex items-start gap-3">
            <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-[#14344f] text-[#cde7f7] shadow-[inset_0_1px_0_rgba(186,230,253,0.14)]">
              <activeMode.icon className="size-4" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-[#e5f2fd]">{activeMode.title}</h2>
              <p className="text-sm leading-6 text-[#93b5cd]">{activeMode.description}</p>
            </div>
          </div>

          <div className="nook-auth-flow-card" data-mode={mode} style={flowStyle}>
            <div className="nook-auth-flow-head">
              <span className="nook-auth-flow-title">{activeJourney.title}</span>
              <span className="nook-auth-flow-count">
                {journeyState.completionCount}/{activeJourney.steps.length}
              </span>
            </div>
            <div className="nook-auth-flow-stage" aria-hidden="true">
              <span className="nook-auth-flow-line" />
              <span className="nook-auth-flow-progress" />
              <span className="nook-auth-flow-line-glow" />
              <span className="nook-auth-flow-traveler" />
              <span className="nook-auth-flow-marker" />
              {activeJourney.steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`nook-auth-flow-node nook-auth-flow-node-${index + 1}`}
                  data-tone={step.tone}
                  data-complete={journeyState.completed[index] ? "true" : "false"}
                  data-active={journeyState.activeIndex === index ? "true" : "false"}
                >
                  <step.icon className="size-3.5" />
                </div>
              ))}
              {activeJourney.steps.map((step, index) => (
                <span
                  key={`${step.id}-label`}
                  className={`nook-auth-flow-label nook-auth-flow-label-${index + 1}`}
                  data-tone={step.tone}
                  data-complete={journeyState.completed[index] ? "true" : "false"}
                >
                  {step.label}
                </span>
              ))}
            </div>
            <p className="nook-auth-flow-caption">{journeyState.caption}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 pt-6">
        {activeFeedback ? <FeedbackBanner feedback={activeFeedback} /> : null}

        {awaitingVerification ? (
          <div className="nook-auth-mode-body rounded-2xl border border-[#4d7e9f] bg-[#12334c] p-4 text-sm leading-6 text-[#bde2f6]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-[#184465] text-[#8fdbf8]">
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
                  className="rounded-xl border-[#3e6887] bg-[#13324b] text-[#c8e5f6] hover:bg-[#183b58]"
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
          <div className="nook-auth-mode-body space-y-5">
            <form className="space-y-4" onSubmit={handleSignIn}>
              <BotTrap
                value={guardState["sign-in"].website}
                onChange={(value) => updateGuard("sign-in", { website: value })}
              />

              <div className="space-y-1.5">
                <FieldLabel htmlFor="signin-email">Email</FieldLabel>
                <IconInput
                  id="signin-email"
                  name="email"
                  type="email"
                  value={signInForm.email}
                  onChange={(event) =>
                    setSignInForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  icon={Mail}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="signin-password">Пароль</FieldLabel>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#7fd6f2] hover:text-[#b3e9fb]"
                    onClick={() => {
                      openMode("reset");
                      setResetEmail(signInForm.email);
                    }}
                  >
                    Забыли пароль?
                  </button>
                </div>
                <IconInput
                  id="signin-password"
                  name="password"
                  type={showSignInPassword ? "text" : "password"}
                  value={signInForm.password}
                  onChange={(event) =>
                    setSignInForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  icon={KeyRound}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword((current) => !current)}
                      className="rounded-lg p-2 hover:bg-[#1d3d58]"
                      aria-label={showSignInPassword ? "Скрыть пароль" : "Показать пароль"}
                    >
                      {showSignInPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                  required
                />
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-base"
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
                    Открыть рабочую область
                  </>
                )}
              </Button>
            </form>

            <div className="rounded-2xl border border-[#315977] bg-[#102a42] p-4">
              <p className="text-sm font-semibold text-[#e3f1fb]">Нет аккаунта?</p>
              <p className="mt-1 text-sm leading-6 text-[#95b8cf]">
                Отправьте заявку. После одобрения вы получите письмо и сможете войти.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-11 w-full rounded-xl"
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
          </div>
        ) : null}

        {mode === "sign-up" ? (
          <div className="nook-auth-mode-body space-y-5">
            <form className="space-y-4" onSubmit={handleSignUp}>
              <BotTrap
                value={guardState["sign-up"].website}
                onChange={(value) => updateGuard("sign-up", { website: value })}
              />

              <div className="space-y-1.5">
                <FieldLabel htmlFor="signup-name">Имя</FieldLabel>
                <IconInput
                  id="signup-name"
                  name="name"
                  value={signUpForm.name}
                  onChange={(event) =>
                    setSignUpForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Как к вам обращаться"
                  autoComplete="name"
                  icon={User}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                <IconInput
                  id="signup-email"
                  name="email"
                  type="email"
                  value={signUpForm.email}
                  onChange={(event) =>
                    setSignUpForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  icon={Mail}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="signup-password">Пароль</FieldLabel>
                  <IconInput
                    id="signup-password"
                    name="password"
                    type={showSignUpPassword ? "text" : "password"}
                    value={signUpForm.password}
                    onChange={(event) =>
                      setSignUpForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Минимум 10 символов"
                    autoComplete="new-password"
                    icon={KeyRound}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword((current) => !current)}
                        className="rounded-lg p-2 hover:bg-[#1d3d58]"
                        aria-label={showSignUpPassword ? "Скрыть пароль" : "Показать пароль"}
                      >
                        {showSignUpPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="signup-password-repeat">Повторите пароль</FieldLabel>
                  <IconInput
                    id="signup-password-repeat"
                    name="confirmPassword"
                    type={showSignUpConfirmPassword ? "text" : "password"}
                    value={signUpForm.confirmPassword}
                    onChange={(event) =>
                      setSignUpForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    placeholder="Повторите пароль"
                    autoComplete="new-password"
                    icon={KeyRound}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowSignUpConfirmPassword((current) => !current)}
                        className="rounded-lg p-2 hover:bg-[#1d3d58]"
                        aria-label={showSignUpConfirmPassword ? "Скрыть пароль" : "Показать пароль"}
                      >
                        {showSignUpConfirmPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    }
                    required
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#315977] bg-[#102a42]/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8db0c9]">
                  Требования к паролю
                </p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {passwordChecks.map((check) => (
                    <div key={check.id} className="flex items-center gap-2 text-sm text-[#9ec0d7]">
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

              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-base"
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
              className="w-full rounded-xl text-[#9ec0d7] hover:bg-[#15344f] hover:text-[#e7f4fe]"
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
          </div>
        ) : null}

        {mode === "reset" ? (
          <div className="nook-auth-mode-body space-y-5">
            <div className="rounded-2xl border border-[#315977] bg-[#102a42]/80 p-4 text-sm leading-6 text-[#96b9d0]">
              Введите email аккаунта. Если он найден в системе, на почту придет ссылка для
              безопасной смены пароля.
            </div>

            <form className="space-y-4" onSubmit={handleReset}>
              <BotTrap
                value={guardState.reset.website}
                onChange={(value) => updateGuard("reset", { website: value })}
              />

              <div className="space-y-1.5">
                <FieldLabel htmlFor="reset-email">Email для восстановления</FieldLabel>
                <IconInput
                  id="reset-email"
                  name="email"
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  icon={Mail}
                  required
                />
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-base"
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
              className="w-full rounded-xl text-[#9ec0d7] hover:bg-[#15344f] hover:text-[#e7f4fe]"
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
