export type AuthFeedback = {
  tone: "error" | "success" | "info";
  text: string;
};

type SearchParamsLike = Pick<URLSearchParams, "get">;

export function extractAuthErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const candidate = error as {
    message?: unknown;
    error?: { message?: unknown };
  };

  if (typeof candidate.message === "string") {
    return candidate.message;
  }

  if (typeof candidate.error?.message === "string") {
    return candidate.error.message;
  }

  return undefined;
}

export function getAuthErrorMessage(message?: string) {
  if (!message) {
    return "Не удалось выполнить запрос авторизации.";
  }

  if (message.startsWith("Почта для регистрации не настроена.")) {
    return message;
  }

  if (message.startsWith("Не удалось отправить письмо подтверждения.")) {
    return message;
  }

  if (message.startsWith("Пароль можно менять не чаще одного раза в 24 часа.")) {
    return message;
  }

  switch (message) {
    case "Invalid email or password":
      return "Неверный email или пароль.";
    case "Invalid password":
      return "Неверный текущий пароль.";
    case "User already exists. Use another email.":
      return "Такой email уже зарегистрирован.";
    case "Password is too short":
    case "Password too short":
      return "Пароль должен быть не короче 8 символов.";
    case "Password too long":
      return "Пароль слишком длинный. Используйте более короткий пароль.";
    case "Invalid email":
      return "Введите корректный email.";
    case "Email not verified":
      return "Email еще не подтвержден. Отправьте письмо повторно или проверьте входящие.";
    case "Reset password isn't enabled":
      return "Сброс пароля пока не настроен на сервере.";
    case "Verification email isn't enabled":
      return "Письма подтверждения пока не настроены на сервере.";
    case "Invalid token":
      return "Ссылка устарела или уже недействительна.";
    case "HTTP_500":
      return "Серверная ошибка при авторизации. Проверьте настройки почты и логи сервера.";
    case "No fields to update":
      return "Нет изменений для сохранения.";
    default:
      return "Не удалось выполнить запрос авторизации.";
  }
}

export function getQueryAuthFeedback(
  searchParams: SearchParamsLike
): AuthFeedback | null {
  const reset = searchParams.get("reset");
  const error = searchParams.get("error");

  if (reset === "success") {
    return {
      tone: "success",
      text: "Пароль обновлен. Теперь можно войти с новым паролем.",
    };
  }

  switch (error) {
    case "token_expired":
      return {
        tone: "error",
        text: "Ссылка истекла. Запросите новое письмо.",
      };
    case "invalid_token":
    case "INVALID_TOKEN":
      return {
        tone: "error",
        text: "Ссылка недействительна. Запросите новое письмо.",
      };
    case "user_not_found":
      return {
        tone: "error",
        text: "Пользователь для этой ссылки не найден.",
      };
    default:
      return null;
  }
}
