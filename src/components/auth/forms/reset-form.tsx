"use client";

import { type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { BotTrap, TextField } from "@/components/auth/forms/form-fields";
import { Button } from "@/components/ui/button";

type ResetFormProps = {
  email: string;
  guardWebsite: string;
  isPending: boolean;
  onEmailChange: (value: string) => void;
  onGuardWebsiteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBackToSignIn: () => void;
};

function getFieldValue(event: ChangeEvent<HTMLInputElement>) {
  return event.target.value;
}

export function ResetForm({
  email,
  guardWebsite,
  isPending,
  onEmailChange,
  onGuardWebsiteChange,
  onSubmit,
  onBackToSignIn,
}: ResetFormProps) {
  return (
    <div className="space-y-5">
      <div className="nook-panel-soft rounded-xl p-4 text-sm leading-6 text-muted-foreground">
        Введите email аккаунта. Если адрес найден, пришлем ссылку и вернем вас к жизни без паники.
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <BotTrap value={guardWebsite} onChange={(event) => onGuardWebsiteChange(getFieldValue(event))} />

        <TextField
          id="reset-email"
          type="email"
          label="Email для восстановления"
          value={email}
          onChange={(event) => onEmailChange(getFieldValue(event))}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <Button type="submit" className="h-11 w-full" disabled={isPending}>
          <Mail className="size-4" />
          {isPending ? "Отправляем письмо..." : "Вернуть доступ"}
        </Button>
      </form>

      <Button type="button" variant="ghost" className="w-full" onClick={onBackToSignIn}>
        <ArrowLeft className="size-4" />
        Назад ко входу
      </Button>
    </div>
  );
}
