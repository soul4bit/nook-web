"use client";

import { type ChangeEvent, type FormEvent, useMemo } from "react";
import { ArrowLeft, CheckCircle2, Circle, UserPlus } from "lucide-react";
import { BotTrap, PasswordField, TextField } from "@/components/auth/forms/form-fields";
import { Button } from "@/components/ui/button";

type SignUpFormProps = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  guardWebsite: string;
  isPending: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onGuardWebsiteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBackToSignIn: () => void;
};

function getFieldValue(event: ChangeEvent<HTMLInputElement>) {
  return event.target.value;
}

export function SignUpForm({
  name,
  email,
  password,
  confirmPassword,
  guardWebsite,
  isPending,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onGuardWebsiteChange,
  onSubmit,
  onBackToSignIn,
}: SignUpFormProps) {
  const passwordChecks = useMemo(() => {
    const hasLetters = /\p{L}/u.test(password);
    const hasDigits = /\d/.test(password);

    return [
      {
        id: "length",
        text: "10-128 символов",
        passed: password.length >= 10 && password.length <= 128,
      },
      {
        id: "letters",
        text: "Есть буквы",
        passed: hasLetters,
      },
      {
        id: "digits",
        text: "Есть цифры",
        passed: hasDigits,
      },
      {
        id: "match",
        text: "Пароли совпадают",
        passed: confirmPassword.length > 0 && confirmPassword === password,
      },
    ];
  }, [confirmPassword, password]);

  return (
    <div className="space-y-5">
      <form className="space-y-4" onSubmit={onSubmit}>
        <BotTrap value={guardWebsite} onChange={(event) => onGuardWebsiteChange(getFieldValue(event))} />

        <TextField
          id="signup-name"
          label="Как вас звать"
          value={name}
          onChange={(event) => onNameChange(getFieldValue(event))}
          placeholder="Например: Дежурный по продакшену"
          autoComplete="name"
          required
        />

        <TextField
          id="signup-email"
          type="email"
          label="Email"
          value={email}
          onChange={(event) => onEmailChange(getFieldValue(event))}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            id="signup-password"
            label="Пароль"
            value={password}
            onChange={(event) => onPasswordChange(getFieldValue(event))}
            placeholder="Минимум 10 символов"
            autoComplete="new-password"
            required
          />
          <PasswordField
            id="signup-password-confirm"
            label="Повтор пароля"
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(getFieldValue(event))}
            placeholder="Повторите пароль"
            autoComplete="new-password"
            required
          />
        </div>

        <div className="nook-panel-soft rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            Мини-чеклист пароля
          </p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {passwordChecks.map((check) => (
              <div key={check.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                {check.passed ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <Circle className="size-4 text-muted-foreground/75" />
                )}
                <span className={check.passed ? "text-foreground" : ""}>{check.text}</span>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" className="h-11 w-full" disabled={isPending}>
          <UserPlus className="size-4" />
          {isPending ? "Отправляем заявку..." : "Вступить в клуб адекватных заметок"}
        </Button>
      </form>

      <Button type="button" variant="ghost" className="w-full" onClick={onBackToSignIn}>
        <ArrowLeft className="size-4" />
        Назад ко входу
      </Button>
    </div>
  );
}
