"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  Save,
  ShieldCheck,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import { UserAvatar } from "@/components/user/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeAvatarUrl, withAvatarVersion } from "@/lib/account/avatar";
import {
  extractAuthErrorMessage,
  getAuthErrorMessage,
  type AuthFeedback,
} from "@/lib/auth/messages";

type AccountSettingsProps = {
  user: {
    name: string | null;
    email: string;
    image?: string | null;
    emailVerified?: boolean;
  };
  passwordStatus: {
    canChange: boolean;
    nextAllowedAt: string | null;
  };
};

type PendingAction = "profile" | "password" | null;

async function postJson(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
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

async function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/account/avatar", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const result = (await response.json()) as { imageUrl?: string; message?: string };

  if (!response.ok || !result.imageUrl) {
    throw new Error(result.message ?? "Не удалось загрузить аватар.");
  }

  return result.imageUrl;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function FeedbackBanner({ feedback }: { feedback: AuthFeedback }) {
  const toneClass =
    feedback.tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : feedback.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${toneClass}`}>
      {feedback.text}
    </div>
  );
}

export function AccountSettings({ user, passwordStatus }: AccountSettingsProps) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [currentImage, setCurrentImage] = useState(normalizeAvatarUrl(user.image));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [profileFeedback, setProfileFeedback] = useState<AuthFeedback | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<AuthFeedback | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [previewImage, setPreviewImage] = useState<string | null>(normalizeAvatarUrl(user.image));
  const [passwordNextAllowedAt, setPasswordNextAllowedAt] = useState<string | null>(
    passwordStatus.nextAllowedAt
  );
  const isPasswordLocked = Boolean(
    passwordNextAllowedAt && new Date(passwordNextAllowedAt).getTime() > Date.now()
  );

  const passwordCooldownText = useMemo(() => {
    if (!passwordNextAllowedAt) {
      return "Пароль можно менять не чаще одного раза в 24 часа.";
    }

    return `Следующая смена пароля будет доступна ${formatDateTime(passwordNextAllowedAt)}.`;
  }, [passwordNextAllowedAt]);

  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewImage(objectUrl);

      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }

    setPreviewImage(removeAvatar ? null : currentImage);
  }, [currentImage, removeAvatar, selectedFile]);

  function resetAvatarInput() {
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);
    setRemoveAvatar(false);
    setProfileFeedback(null);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile && !removeAvatar) {
      setProfileFeedback({ tone: "info", text: "Изменений для аватара пока нет." });
      return;
    }

    setPendingAction("profile");
    setProfileFeedback(null);

    try {
      let image = removeAvatar ? null : normalizeAvatarUrl(currentImage);

      if (selectedFile) {
        image = await uploadAvatar(selectedFile);
      }

      await postJson("/api/auth/update-user", {
        image,
      });

      const displayImage = withAvatarVersion(image);

      setCurrentImage(displayImage);
      setSelectedFile(null);
      setRemoveAvatar(false);
      resetAvatarInput();
      setProfileFeedback({
        tone: "success",
        text: "Аватар обновлен.",
      });
      router.refresh();
    } catch (error) {
      setProfileFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? getAuthErrorMessage(error.message)
            : "Не удалось обновить аватар.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPasswordLocked && passwordNextAllowedAt) {
      setPasswordFeedback({
        tone: "info",
        text: `Пароль можно менять не чаще одного раза в 24 часа. Следующая смена будет доступна ${formatDateTime(passwordNextAllowedAt)}.`,
      });
      return;
    }

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: "error", text: "Заполните все поля для смены пароля." });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: "error", text: "Новый пароль и повтор не совпадают." });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordFeedback({ tone: "error", text: "Новый пароль должен быть не короче 8 символов." });
      return;
    }

    setPendingAction("password");
    setPasswordFeedback(null);

    try {
      const result = (await postJson("/api/account/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        revokeOtherSessions: true,
      })) as { nextAllowedAt?: string | null };

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordNextAllowedAt(result.nextAllowedAt ?? null);
      setPasswordFeedback({
        tone: "success",
        text: "Пароль обновлен. Следующая смена будет доступна через 24 часа.",
      });
      router.refresh();
    } catch (error) {
      setPasswordFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? getAuthErrorMessage(error.message)
            : "Не удалось сменить пароль.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="rounded-[28px] border border-slate-300 bg-[#f3f6fa] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Профиль
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Личный кабинет
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Здесь можно управлять аватаром и безопасностью аккаунта.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-slate-300 bg-[#f3f6fa] text-slate-700 hover:bg-[#e9eef4]"
          >
            <Link href="/app">
              <ArrowLeft className="size-4" />К заметкам
            </Link>
          </Button>
        </div>

        <div className="mt-8 rounded-[20px] border border-slate-200 bg-[#f8fafc] p-5">
          <div className="flex items-center gap-4">
            <UserAvatar
              image={previewImage}
              name={user.name || user.email}
              className="size-20 rounded-[20px] border-slate-200 bg-white"
              fallbackClassName="text-xl text-[#3b82a4]"
            />
            <div>
              <p className="text-xl font-semibold text-slate-900">{user.name || "Без имени"}</p>
              <p className="mt-1 text-sm text-slate-600">{user.email}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                <ShieldCheck className="size-3.5 text-[#3b82a4]" />
                {user.emailVerified ? "Почта подтверждена" : "Почта не подтверждена"}
              </div>
            </div>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleProfileSubmit}>
          {profileFeedback ? <FeedbackBanner feedback={profileFeedback} /> : null}

          <div className="space-y-2">
            <label htmlFor="avatar" className="text-sm font-medium text-slate-700">
              Аватар
            </label>
            <div className="rounded-[20px] border border-slate-200 bg-[#f8fafc] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <ImagePlus className="size-4" />
                  Выбрать изображение
                  <input
                    ref={avatarInputRef}
                    id="avatar"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-slate-300 bg-[#f3f6fa] text-slate-700 hover:bg-[#e9eef4]"
                  onClick={() => {
                    setSelectedFile(null);
                    setRemoveAvatar(true);
                    setProfileFeedback(null);
                    resetAvatarInput();
                  }}
                >
                  <Trash2 className="size-4" />
                  Убрать аватар
                </Button>
              </div>

              <p className="mt-3 text-sm text-slate-600">JPG, PNG, WEBP или GIF. Максимум 2 МБ.</p>
              {selectedFile ? (
                <p className="mt-2 text-xs text-slate-500">Выбран файл: {selectedFile.name}</p>
              ) : null}
            </div>
          </div>

          <Button
            type="submit"
            className="rounded-2xl bg-[#3b82a4] px-5 text-white hover:bg-[#327391]"
            disabled={pendingAction === "profile"}
          >
            {pendingAction === "profile" ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Сохраняем аватар...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Сохранить профиль
              </>
            )}
          </Button>
        </form>
      </section>

      <section className="rounded-[28px] border border-slate-300 bg-[#f3f6fa] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Безопасность
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          Смена пароля
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Пароль можно менять не чаще одного раза в 24 часа. После успешной смены остальные
          сессии автоматически завершаются.
        </p>

        <div className="mt-5 rounded-[18px] border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm leading-7 text-slate-600">
          {passwordCooldownText}
        </div>

        <form className="mt-8 space-y-5" onSubmit={handlePasswordSubmit}>
          {passwordFeedback ? <FeedbackBanner feedback={passwordFeedback} /> : null}

          <div className="space-y-2">
            <label htmlFor="current-password" className="text-sm font-medium text-slate-700">
              Текущий пароль
            </label>
            <Input
              id="current-password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
              className="h-12 rounded-2xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
              placeholder="Введите текущий пароль"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium text-slate-700">
              Новый пароль
            </label>
            <Input
              id="new-password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  newPassword: event.target.value,
                }))
              }
              className="h-12 rounded-2xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
              placeholder="Минимум 8 символов"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">
              Повторите новый пароль
            </label>
            <Input
              id="confirm-password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
              className="h-12 rounded-2xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
              placeholder="Повторите новый пароль"
            />
          </div>

          <Button
            type="submit"
            className="rounded-2xl bg-[#3b82a4] px-5 text-white hover:bg-[#327391]"
            disabled={pendingAction === "password" || isPasswordLocked}
          >
            {pendingAction === "password" ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Меняем пароль...
              </>
            ) : (
              <>
                <KeyRound className="size-4" />
                Сменить пароль
              </>
            )}
          </Button>
        </form>

        <div className="mt-8 rounded-[18px] border border-slate-200 bg-[#f8fafc] p-4 text-sm leading-7 text-slate-600">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UserRoundCog className="size-4 text-[#3b82a4]" />
            Как это хранится
          </div>
          <p>
            Аватар хранится локально на сервере, а в профиле пользователя сохраняется только URL в
            поле `image`.
          </p>
        </div>
      </section>
    </div>
  );
}

