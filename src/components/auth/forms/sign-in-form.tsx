"use client";

import { type ChangeEvent, type FormEvent } from "react";
import { ArrowRight, KeyRound, UserPlus } from "lucide-react";
import { BotTrap, PasswordField, TextField } from "@/components/auth/forms/form-fields";
import { Button } from "@/components/ui/button";

type SignInFormProps = {
  email: string;
  password: string;
  guardWebsite: string;
  isPending: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onGuardWebsiteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onForgotPassword: () => void;
  onOpenSignUp: () => void;
};

function getFieldValue(event: ChangeEvent<HTMLInputElement>) {
  return event.target.value;
}

export function SignInForm({
  email,
  password,
  guardWebsite,
  isPending,
  onEmailChange,
  onPasswordChange,
  onGuardWebsiteChange,
  onSubmit,
  onForgotPassword,
  onOpenSignUp,
}: SignInFormProps) {
  return (
    <div className="space-y-5">
      <form className="space-y-4" onSubmit={onSubmit}>
        <BotTrap value={guardWebsite} onChange={(event) => onGuardWebsiteChange(getFieldValue(event))} />

        <TextField
          id="signin-email"
          type="email"
          label="Email"
          value={email}
          onChange={(event) => onEmailChange(getFieldValue(event))}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">Пароль</p>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:text-primary/80"
              onClick={onForgotPassword}
            >
              Я забыл пароль
            </button>
          </div>

          <PasswordField
            id="signin-password"
            label=""
            value={password}
            onChange={(event) => onPasswordChange(getFieldValue(event))}
            placeholder="Введите пароль"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" className="h-11 w-full" disabled={isPending}>
          {isPending ? "Проверяем доступ..." : "Войти и навести порядок"}
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <div className="nook-panel-soft rounded-xl p-4">
        <p className="text-sm font-medium text-foreground">Первый раз здесь?</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Отправьте заявку и получите доступ после одобрения. Вики любит порядок и админов.
        </p>
        <Button type="button" variant="outline" className="mt-3 w-full" onClick={onOpenSignUp}>
          <UserPlus className="size-4" />
          Запросить доступ
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <KeyRound className="size-3.5" />
        Внутри: anti-bot, rate limit и журнал попыток. Да, мы серьезные.
      </div>
    </div>
  );
}
