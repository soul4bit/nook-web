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
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : feedback.tone === "success"
        ? "border-[#245945] bg-[#14241d] text-[#53e6a6]"
        : "border-sky-500/30 bg-sky-500/10 text-sky-200";

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
      <section className="rounded-[32px] border border-[#29312d] bg-[#171c19] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#6d8379]">
              Профиль
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Личный кабинет
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#8fa59c]">
              Здесь можно управлять аватаром и безопасностью аккаунта. Имя из регистрации остается как есть,
              без отдельного редактирования.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-[#2b3531] bg-[#111513] text-white hover:bg-[#1a201d]"
          >
            <Link href="/app">
              <ArrowLeft className="size-4" />
              К заметкам
            </Link>
          </Button>
        </div>

        <div className="mt-8 rounded-[28px] border border-[#29312d] bg-[#111513] p-5">
          <div className="flex items-center gap-4">
            <UserAvatar
              image={previewImage}
              name={user.name || user.email}
              className="size-20 rounded-[24px]"
              fallbackClassName="text-xl"
            />
            <div>
              <p className="text-xl font-semibold text-white">
                {user.name || "Без имени"}
              </p>
              <p className="mt-1 text-sm text-[#8fa59c]">{user.email}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#2b3531] px-3 py-1 text-xs text-[#a0b6ad]">
                <ShieldCheck className="size-3.5 text-[#53e6a6]" />
                {user.emailVerified ? "Почта подтверждена" : "Почта не подтверждена"}
              </div>
            </div>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleProfileSubmit}>
          {profileFeedback ? <FeedbackBanner feedback={profileFeedback} /> : null}

          <div className="space-y-2">
            <label htmlFor="avatar" className="text-sm font-medium text-white">
              Аватар
            </label>
            <div className="rounded-[24px] border border-[#29312d] bg-[#111513] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[#2b3531] bg-[#171c19] px-4 py-2 text-sm text-white hover:bg-[#1c2320]">
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
                  className="rounded-2xl border-[#2b3531] bg-[#171c19] text-white hover:bg-[#1c2320]"
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

              <p className="mt-3 text-sm text-[#7d958b]">
                JPG, PNG, WEBP или GIF. Максимум 2 МБ.
              </p>
              {selectedFile ? (
                <p className="mt-2 text-xs text-[#9eb2aa]">Выбран файл: {selectedFile.name}</p>
              ) : null}
            </div>
          </div>

          <Button
            type="submit"
            className="rounded-2xl bg-[#53e6a6] px-5 text-[#09120e] hover:bg-[#46ce93]"
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

      <section className="rounded-[32px] border border-[#29312d] bg-[#171c19] p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#6d8379]">
          Безопасность
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          Смена пароля
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#8fa59c]">
          Пароль можно менять не чаще одного раза в 24 часа. После успешной смены остальные сессии
          будут автоматически завершены.
        </p>

        <div className="mt-5 rounded-[24px] border border-[#29312d] bg-[#111513] px-4 py-3 text-sm leading-7 text-[#9ab0a6]">
          {passwordCooldownText}
        </div>

        <form className="mt-8 space-y-5" onSubmit={handlePasswordSubmit}>
          {passwordFeedback ? <FeedbackBanner feedback={passwordFeedback} /> : null}

          <div className="space-y-2">
            <label htmlFor="current-password" className="text-sm font-medium text-white">
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
              className="h-12 rounded-2xl border-[#2b3531] bg-[#111513] text-white placeholder:text-[#6f877e]"
              placeholder="Введите текущий пароль"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium text-white">
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
              className="h-12 rounded-2xl border-[#2b3531] bg-[#111513] text-white placeholder:text-[#6f877e]"
              placeholder="Минимум 8 символов"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium text-white">
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
              className="h-12 rounded-2xl border-[#2b3531] bg-[#111513] text-white placeholder:text-[#6f877e]"
              placeholder="Повторите новый пароль"
            />
          </div>

          <Button
            type="submit"
            className="rounded-2xl bg-[#53e6a6] px-5 text-[#09120e] hover:bg-[#46ce93]"
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

        <div className="mt-8 rounded-[24px] border border-[#29312d] bg-[#111513] p-4 text-sm leading-7 text-[#8fa59c]">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <UserRoundCog className="size-4 text-[#53e6a6]" />
            Как это хранится
          </div>
          <p>
            Аватар лежит локально на сервере, а в таблице пользователя сохраняется только URL в поле `image`.
          </p>
        </div>
      </section>
    </div>
  );
}
