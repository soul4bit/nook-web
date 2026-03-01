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
    throw new Error(result.message ?? "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р°РІР°С‚Р°СЂ.");
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
      return "РџР°СЂРѕР»СЊ РјРѕР¶РЅРѕ РјРµРЅСЏС‚СЊ РЅРµ С‡Р°С‰Рµ РѕРґРЅРѕРіРѕ СЂР°Р·Р° РІ 24 С‡Р°СЃР°.";
    }

    return `РЎР»РµРґСѓСЋС‰Р°СЏ СЃРјРµРЅР° РїР°СЂРѕР»СЏ Р±СѓРґРµС‚ РґРѕСЃС‚СѓРїРЅР° ${formatDateTime(passwordNextAllowedAt)}.`;
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
      setProfileFeedback({ tone: "info", text: "РР·РјРµРЅРµРЅРёР№ РґР»СЏ Р°РІР°С‚Р°СЂР° РїРѕРєР° РЅРµС‚." });
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
        text: "РђРІР°С‚Р°СЂ РѕР±РЅРѕРІР»РµРЅ.",
      });
      router.refresh();
    } catch (error) {
      setProfileFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? getAuthErrorMessage(error.message)
            : "РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ Р°РІР°С‚Р°СЂ.",
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
        text: `РџР°СЂРѕР»СЊ РјРѕР¶РЅРѕ РјРµРЅСЏС‚СЊ РЅРµ С‡Р°С‰Рµ РѕРґРЅРѕРіРѕ СЂР°Р·Р° РІ 24 С‡Р°СЃР°. РЎР»РµРґСѓСЋС‰Р°СЏ СЃРјРµРЅР° Р±СѓРґРµС‚ РґРѕСЃС‚СѓРїРЅР° ${formatDateTime(passwordNextAllowedAt)}.`,
      });
      return;
    }

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: "error", text: "Р—Р°РїРѕР»РЅРёС‚Рµ РІСЃРµ РїРѕР»СЏ РґР»СЏ СЃРјРµРЅС‹ РїР°СЂРѕР»СЏ." });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: "error", text: "РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ Рё РїРѕРІС‚РѕСЂ РЅРµ СЃРѕРІРїР°РґР°СЋС‚." });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordFeedback({ tone: "error", text: "РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµ РєРѕСЂРѕС‡Рµ 8 СЃРёРјРІРѕР»РѕРІ." });
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
        text: "РџР°СЂРѕР»СЊ РѕР±РЅРѕРІР»РµРЅ. РЎР»РµРґСѓСЋС‰Р°СЏ СЃРјРµРЅР° Р±СѓРґРµС‚ РґРѕСЃС‚СѓРїРЅР° С‡РµСЂРµР· 24 С‡Р°СЃР°.",
      });
      router.refresh();
    } catch (error) {
      setPasswordFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? getAuthErrorMessage(error.message)
            : "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ.",
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
              РџСЂРѕС„РёР»СЊ
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Р—РґРµСЃСЊ РјРѕР¶РЅРѕ СѓРїСЂР°РІР»СЏС‚СЊ Р°РІР°С‚Р°СЂРѕРј Рё Р±РµР·РѕРїР°СЃРЅРѕСЃС‚СЊСЋ Р°РєРєР°СѓРЅС‚Р°.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-slate-300 bg-[#f3f6fa] text-slate-700 hover:bg-[#e9eef4]"
          >
            <Link href="/app">
              <ArrowLeft className="size-4" />Рљ Р·Р°РјРµС‚РєР°Рј
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
              <p className="text-xl font-semibold text-slate-900">{user.name || "Р‘РµР· РёРјРµРЅРё"}</p>
              <p className="mt-1 text-sm text-slate-600">{user.email}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                <ShieldCheck className="size-3.5 text-[#3b82a4]" />
                {user.emailVerified ? "РџРѕС‡С‚Р° РїРѕРґС‚РІРµСЂР¶РґРµРЅР°" : "РџРѕС‡С‚Р° РЅРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅР°"}
              </div>
            </div>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleProfileSubmit}>
          {profileFeedback ? <FeedbackBanner feedback={profileFeedback} /> : null}

          <div className="space-y-2">
            <label htmlFor="avatar" className="text-sm font-medium text-slate-700">
              РђРІР°С‚Р°СЂ
            </label>
            <div className="rounded-[20px] border border-slate-200 bg-[#f8fafc] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <ImagePlus className="size-4" />
                  Р’С‹Р±СЂР°С‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ
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
                  РЈР±СЂР°С‚СЊ Р°РІР°С‚Р°СЂ
                </Button>
              </div>

              <p className="mt-3 text-sm text-slate-600">JPG, PNG, WEBP РёР»Рё GIF. РњР°РєСЃРёРјСѓРј 2 РњР‘.</p>
              {selectedFile ? (
                <p className="mt-2 text-xs text-slate-500">Р’С‹Р±СЂР°РЅ С„Р°Р№Р»: {selectedFile.name}</p>
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
                РЎРѕС…СЂР°РЅСЏРµРј Р°РІР°С‚Р°СЂ...
              </>
            ) : (
              <>
                <Save className="size-4" />
                РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ
              </>
            )}
          </Button>
        </form>
      </section>

      <section className="rounded-[28px] border border-slate-300 bg-[#f3f6fa] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Р‘РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          РЎРјРµРЅР° РїР°СЂРѕР»СЏ
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          РџР°СЂРѕР»СЊ РјРѕР¶РЅРѕ РјРµРЅСЏС‚СЊ РЅРµ С‡Р°С‰Рµ РѕРґРЅРѕРіРѕ СЂР°Р·Р° РІ 24 С‡Р°СЃР°. РџРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕР№ СЃРјРµРЅС‹ РѕСЃС‚Р°Р»СЊРЅС‹Рµ
          СЃРµСЃСЃРёРё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё Р·Р°РІРµСЂС€Р°СЋС‚СЃСЏ.
        </p>

        <div className="mt-5 rounded-[18px] border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm leading-7 text-slate-600">
          {passwordCooldownText}
        </div>

        <form className="mt-8 space-y-5" onSubmit={handlePasswordSubmit}>
          {passwordFeedback ? <FeedbackBanner feedback={passwordFeedback} /> : null}

          <div className="space-y-2">
            <label htmlFor="current-password" className="text-sm font-medium text-slate-700">
              РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ
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
              placeholder="Р’РІРµРґРёС‚Рµ С‚РµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium text-slate-700">
              РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ
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
              placeholder="РњРёРЅРёРјСѓРј 8 СЃРёРјРІРѕР»РѕРІ"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">
              РџРѕРІС‚РѕСЂРёС‚Рµ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ
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
              placeholder="РџРѕРІС‚РѕСЂРёС‚Рµ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ"
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
                РњРµРЅСЏРµРј РїР°СЂРѕР»СЊ...
              </>
            ) : (
              <>
                <KeyRound className="size-4" />
                РЎРјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ
              </>
            )}
          </Button>
        </form>

        <div className="mt-8 rounded-[18px] border border-slate-200 bg-[#f8fafc] p-4 text-sm leading-7 text-slate-600">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UserRoundCog className="size-4 text-[#3b82a4]" />
            РљР°Рє СЌС‚Рѕ С…СЂР°РЅРёС‚СЃСЏ
          </div>
          <p>
            РђРІР°С‚Р°СЂ С…СЂР°РЅРёС‚СЃСЏ Р»РѕРєР°Р»СЊРЅРѕ РЅР° СЃРµСЂРІРµСЂРµ, Р° РІ РїСЂРѕС„РёР»Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ URL РІ
            РїРѕР»Рµ `image`.
          </p>
        </div>
      </section>
    </div>
  );
}

