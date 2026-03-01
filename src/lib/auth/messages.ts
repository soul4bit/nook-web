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

  if (message.startsWith("Слишком много")) {
    return message;
  }

  if (message.startsWith("Похоже на автоматический запрос.")) {
    return message;
  }

  if (message.startsWith("Форма устарела.")) {
    return message;
  }

  if (message.startsWith("Слишком быстрый запрос.")) {
    return message;
  }

  if (message.startsWith("Не удалось подтвердить запрос.")) {
    return message;
  }

  if (message.startsWith("Имя ")) {
    return message;
  }

  if (message.startsWith("Часы на устройстве")) {
    return message;
  }

  if (message.startsWith("Серверная ошибка при авторизации.")) {
    return message;
  }

  if (message.startsWith("Серверная ошибка при регистрации.")) {
    return message;
  }

  if (message.startsWith("Регистрация через Telegram")) {
    return message;
  }

  if (message.startsWith("Заявка на регистрацию")) {
    return message;
  }

  if (message.startsWith("Такой email")) {
    return message;
  }

  if (message.startsWith("Telegram registration is not configured on the server.")) {
    return "Регистрация через Telegram пока не настроена на сервере.";
  }

  if (message.startsWith("Failed to send request to Telegram:")) {
    return "Не удалось отправить заявку в Telegram. Проверьте настройки бота.";
  }

  switch (message) {
    case "Invalid email or password":
      return "Неверный email или пароль.";
    case "Invalid password":
      return "Неверный текущий пароль.";
    case "User already exists. Use another email.":
    case "User with this email already exists.":
      return "Такой email уже зарегистрирован.";
    case "Password is too short":
    case "Password too short":
      return "Пароль должен быть не короче 8 символов.";
    case "Пароль должен быть от 10 до 128 символов и содержать буквы и цифры.":
      return message;
    case "Password too long":
      return "Пароль слишком длинный. Используйте более короткий пароль.";
    case "Invalid email":
      return "Введите корректный email.";
    case "Введите email.":
    case "Введите пароль.":
    case "Некорректный формат запроса.":
    case "Ссылка для сброса пароля недействительна.":
      return message;
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
