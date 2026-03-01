import { type NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/auth/server";

type AuthGuardAction =
  | "sign-in"
  | "sign-up"
  | "password-reset-request"
  | "verification-resend"
  | "password-reset";

type GuardPolicy = {
  minFillMs: number;
  ipLimit: number;
  ipWindowSec: number;
  ipMessage: string;
  emailLimit?: number;
  emailWindowSec?: number;
  emailMessage?: string;
};

type GuardRouteConfig<TPayload extends Record<string, unknown>> = {
  action: AuthGuardAction;
  targetPath: string;
  validate: (body: Record<string, unknown>, request: NextRequest) => TPayload;
};

class AuthGuardError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthGuardError";
    this.status = status;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_REGEX = /^[\p{L}\p{N} .,'_-]+$/u;
const MAX_FORM_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_FUTURE_CLOCK_SKEW_MS = 1000 * 60 * 5;

const guardPolicies: Record<AuthGuardAction, GuardPolicy> = {
  "sign-in": {
    minFillMs: 400,
    ipLimit: 20,
    ipWindowSec: 60 * 15,
    ipMessage: "Слишком много попыток входа. Подождите 15 минут и попробуйте снова.",
    emailLimit: 8,
    emailWindowSec: 60 * 15,
    emailMessage:
      "Слишком много попыток входа для этого email. Подождите 15 минут и попробуйте снова.",
  },
  "sign-up": {
    minFillMs: 1200,
    ipLimit: 6,
    ipWindowSec: 60 * 60,
    ipMessage:
      "Слишком много попыток регистрации с этого адреса. Подождите час и попробуйте снова.",
    emailLimit: 3,
    emailWindowSec: 60 * 60 * 6,
    emailMessage:
      "Для этого email слишком много попыток регистрации. Подождите несколько часов и попробуйте снова.",
  },
  "password-reset-request": {
    minFillMs: 1200,
    ipLimit: 8,
    ipWindowSec: 60 * 60,
    ipMessage:
      "Слишком много запросов на сброс пароля. Подождите час и попробуйте снова.",
    emailLimit: 3,
    emailWindowSec: 60 * 60,
    emailMessage:
      "Для этого email слишком много запросов на сброс пароля. Подождите час и попробуйте снова.",
  },
  "verification-resend": {
    minFillMs: 1200,
    ipLimit: 8,
    ipWindowSec: 60 * 60,
    ipMessage:
      "Слишком много запросов на письма подтверждения. Подождите час и попробуйте снова.",
    emailLimit: 3,
    emailWindowSec: 60 * 60,
    emailMessage:
      "Для этого email письмо уже отправлялось слишком часто. Подождите час и попробуйте снова.",
  },
  "password-reset": {
    minFillMs: 800,
    ipLimit: 10,
    ipWindowSec: 60 * 30,
    ipMessage:
      "Слишком много попыток смены пароля. Подождите 30 минут и попробуйте снова.",
  },
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthGuardError("Некорректный формат запроса.");
  }

  return value as Record<string, unknown>;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return getString(value).toLowerCase();
}

function validateEmail(email: string) {
  if (!email) {
    throw new AuthGuardError("Введите email.");
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new AuthGuardError("Введите корректный email.");
  }

  return email;
}

function validatePasswordStrength(password: string) {
  if (password.length < 10 || password.length > 128) {
    throw new AuthGuardError(
      "Пароль должен быть от 10 до 128 символов и содержать буквы и цифры."
    );
  }

  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    throw new AuthGuardError(
      "Пароль должен быть от 10 до 128 символов и содержать буквы и цифры."
    );
  }
}

function validateName(value: unknown) {
  const name = getString(value);

  if (name.length < 2 || name.length > 60) {
    throw new AuthGuardError("Имя должно быть длиной от 2 до 60 символов.");
  }

  if (!NAME_REGEX.test(name)) {
    throw new AuthGuardError("Имя содержит недопустимые символы.");
  }

  return name;
}

function sanitizeCallbackUrl(
  value: unknown,
  request: NextRequest,
  fallbackPath: string
) {
  const fallback = new URL(fallbackPath, request.nextUrl.origin).toString();
  const raw = getString(value);

  if (!raw) {
    return fallback;
  }

  try {
    const candidate = new URL(raw, request.nextUrl.origin);

    if (candidate.origin !== request.nextUrl.origin) {
      return fallback;
    }

    return candidate.toString();
  } catch {
    return fallback;
  }
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");

    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip");

  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

function validateHumanChallenge(
  body: Record<string, unknown>,
  action: AuthGuardAction
) {
  const honeypot = getString(body.website);

  if (honeypot) {
    throw new AuthGuardError("Похоже на автоматический запрос. Попробуйте еще раз.");
  }

  const startedAt = Number(body.startedAt);

  if (!Number.isFinite(startedAt)) {
    throw new AuthGuardError(
      "Не удалось подтвердить запрос. Обновите страницу и попробуйте снова."
    );
  }

  const ageMs = Date.now() - startedAt;

  if (ageMs < -MAX_FUTURE_CLOCK_SKEW_MS) {
    throw new AuthGuardError(
      "Часы на устройстве сильно отличаются от времени сервера. Проверьте время и попробуйте снова."
    );
  }

  if (ageMs > MAX_FORM_AGE_MS) {
    throw new AuthGuardError(
      "Форма устарела. Обновите страницу и попробуйте снова."
    );
  }

  if (ageMs < guardPolicies[action].minFillMs) {
    throw new AuthGuardError(
      "Слишком быстрый запрос. Подождите секунду и попробуйте снова."
    );
  }
}

async function applyRateLimit({
  action,
  ipAddress,
  email,
}: {
  action: AuthGuardAction;
  ipAddress: string;
  email?: string;
}) {
  const policy = guardPolicies[action];

  if (Math.random() < 0.03) {
    await pool.query(
      "delete from auth_guard_events where created_at < now() - interval '7 days'"
    );
  }

  const result = await pool.query<{
    ip_count: string;
    email_count: string;
  }>(
    `
      with inserted as (
        insert into auth_guard_events (action, ip_address, email)
        values ($1, $2, $3)
        returning 1
      )
      select
        (
          select count(*)::int
          from auth_guard_events
          where action = $1
            and ip_address = $2
            and created_at >= now() - make_interval(secs => $4)
        ) as ip_count,
        (
          select count(*)::int
          from auth_guard_events
          where action = $1
            and $3 is not null
            and email = $3
            and created_at >= now() - make_interval(secs => $5)
        ) as email_count
      from inserted
    `,
    [
      action,
      ipAddress,
      email ?? null,
      policy.ipWindowSec,
      policy.emailWindowSec ?? 0,
    ]
  );

  const row = result.rows[0];
  const ipCount = Number(row?.ip_count ?? 0);
  const emailCount = Number(row?.email_count ?? 0);

  if (ipCount > policy.ipLimit) {
    throw new AuthGuardError(policy.ipMessage, 429);
  }

  if (
    email &&
    policy.emailLimit &&
    policy.emailMessage &&
    emailCount > policy.emailLimit
  ) {
    throw new AuthGuardError(policy.emailMessage, 429);
  }
}

async function proxyToBetterAuth(
  request: NextRequest,
  path: string,
  payload: Record<string, unknown>
) {
  const response = await fetch(new URL(`/api/auth${path}`, request.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const headers = new Headers();
  const contentType = response.headers.get("content-type");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  const location = response.headers.get("location");

  if (location) {
    headers.set("location", location);
  }

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  for (const cookie of setCookies) {
    headers.append("set-cookie", cookie);
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers,
  });
}

export async function handleGuardedAuthRequest<TPayload extends Record<string, unknown>>(
  request: NextRequest,
  config: GuardRouteConfig<TPayload>
) {
  try {
    const rawBody = asRecord(await request.json());

    validateHumanChallenge(rawBody, config.action);

    const payload = config.validate(rawBody, request);
    const email =
      typeof payload.email === "string" && payload.email ? payload.email : undefined;

    await applyRateLimit({
      action: config.action,
      ipAddress: getClientIp(request),
      email,
    });

    return await proxyToBetterAuth(request, config.targetPath, payload);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("Auth guard failed", error);

    return NextResponse.json(
      { message: "Серверная ошибка при авторизации. Проверьте логи сервера." },
      { status: 500 }
    );
  }
}

export function validateSignInPayload(body: Record<string, unknown>) {
  const email = validateEmail(normalizeEmail(body.email));
  const password = getString(body.password);

  if (!password) {
    throw new AuthGuardError("Введите пароль.");
  }

  return {
    email,
    password,
  };
}

export function validateSignUpPayload(
  body: Record<string, unknown>,
  request: NextRequest
) {
  const name = validateName(body.name);
  const email = validateEmail(normalizeEmail(body.email));
  const password = getString(body.password);

  validatePasswordStrength(password);

  return {
    name,
    email,
    password,
    callbackURL: sanitizeCallbackUrl(body.callbackURL, request, "/app"),
  };
}

export function validatePasswordResetRequestPayload(
  body: Record<string, unknown>,
  request: NextRequest
) {
  const email = validateEmail(normalizeEmail(body.email));

  return {
    email,
    redirectTo: sanitizeCallbackUrl(body.redirectTo, request, "/auth/reset-password"),
  };
}

export function validateVerificationResendPayload(
  body: Record<string, unknown>,
  request: NextRequest
) {
  const email = validateEmail(normalizeEmail(body.email));

  return {
    email,
    callbackURL: sanitizeCallbackUrl(body.callbackURL, request, "/app"),
  };
}

export function validateResetPasswordPayload(body: Record<string, unknown>) {
  const token = getString(body.token);
  const newPassword = getString(body.newPassword);

  if (!token) {
    throw new AuthGuardError("Ссылка для сброса пароля недействительна.");
  }

  validatePasswordStrength(newPassword);

  return {
    token,
    newPassword,
  };
}
