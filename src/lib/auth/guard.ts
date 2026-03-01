import { NextRequest, NextResponse } from "next/server";
import { authHandlers } from "@/lib/auth/handler";
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
  code: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "AuthGuardError";
    this.status = options?.status ?? 400;
    this.code = options?.code ?? "guard_rejected";
    this.details = options?.details;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_REGEX = /^[\p{L}\p{N} .,'_-]+$/u;
const MAX_FORM_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_FUTURE_CLOCK_SKEW_MS = 1000 * 60 * 5;
const AUTH_GUARD_SCHEMA_SQL = `
  create table if not exists auth_guard_events (
    id bigserial primary key,
    action text not null,
    ip_address text not null,
    email text,
    created_at timestamptz not null default now()
  );

  create index if not exists auth_guard_events_action_ip_created_idx
    on auth_guard_events(action, ip_address, created_at desc);

  create index if not exists auth_guard_events_action_email_created_idx
    on auth_guard_events(action, email, created_at desc);

  create table if not exists auth_guard_logs (
    id bigserial primary key,
    event_type text not null,
    action text not null,
    code text not null,
    reason text not null,
    status integer not null,
    ip_address text not null,
    email text,
    user_agent text not null,
    details jsonb,
    created_at timestamptz not null default now()
  );

  create index if not exists auth_guard_logs_created_idx
    on auth_guard_logs(created_at desc);

  create index if not exists auth_guard_logs_action_created_idx
    on auth_guard_logs(action, created_at desc);

  create index if not exists auth_guard_logs_email_created_idx
    on auth_guard_logs(email, created_at desc);

  create index if not exists auth_guard_logs_ip_created_idx
    on auth_guard_logs(ip_address, created_at desc);
`;

let authGuardSchemaPromise: Promise<void> | null = null;

const guardPolicies: Record<AuthGuardAction, GuardPolicy> = {
  "sign-in": {
    minFillMs: 0,
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
    throw new AuthGuardError("Некорректный формат запроса.", {
      code: "invalid_payload",
    });
  }

  return value as Record<string, unknown>;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return getString(value).toLowerCase();
}

function getEmailForLog(value: unknown) {
  const email = normalizeEmail(value);
  return email || undefined;
}

function validateEmail(email: string) {
  if (!email) {
    throw new AuthGuardError("Введите email.", {
      code: "missing_email",
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new AuthGuardError("Введите корректный email.", {
      code: "invalid_email",
    });
  }

  return email;
}

function validatePasswordStrength(password: string) {
  if (password.length < 10 || password.length > 128) {
    throw new AuthGuardError(
      "Пароль должен быть от 10 до 128 символов и содержать буквы и цифры.",
      {
        code: "weak_password_length",
      }
    );
  }

  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    throw new AuthGuardError(
      "Пароль должен быть от 10 до 128 символов и содержать буквы и цифры.",
      {
        code: "weak_password_format",
      }
    );
  }
}

function validateName(value: unknown) {
  const name = getString(value);

  if (name.length < 2 || name.length > 60) {
    throw new AuthGuardError("Имя должно быть длиной от 2 до 60 символов.", {
      code: "invalid_name_length",
    });
  }

  if (!NAME_REGEX.test(name)) {
    throw new AuthGuardError("Имя содержит недопустимые символы.", {
      code: "invalid_name_format",
    });
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

function getUserAgent(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  return userAgent.length > 200 ? `${userAgent.slice(0, 200)}...` : userAgent;
}

function logAuthGuardBlock({
  action,
  ipAddress,
  email,
  userAgent,
  error,
}: {
  action: AuthGuardAction;
  ipAddress: string;
  email?: string;
  userAgent: string;
  error: AuthGuardError;
}) {
  console.warn(
    `[auth-guard:block] ${JSON.stringify({
      action,
      code: error.code,
      reason: error.message,
      status: error.status,
      ipAddress,
      email: email ?? null,
      userAgent,
      details: error.details ?? null,
    })}`
  );
}

function getSerializableDetails(details?: Record<string, unknown>) {
  if (!details) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(details)) as Record<string, unknown>;
  } catch {
    return {
      serializationError: true,
    };
  }
}

async function persistAuthGuardLog({
  eventType,
  action,
  code,
  reason,
  status,
  ipAddress,
  email,
  userAgent,
  details,
}: {
  eventType: "block" | "error";
  action: AuthGuardAction;
  code: string;
  reason: string;
  status: number;
  ipAddress: string;
  email?: string;
  userAgent: string;
  details?: Record<string, unknown>;
}) {
  try {
    await ensureAuthGuardSchema();
    await pool.query(
      `
        insert into auth_guard_logs (
          event_type,
          action,
          code,
          reason,
          status,
          ip_address,
          email,
          user_agent,
          details
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        eventType,
        action,
        code,
        reason,
        status,
        ipAddress,
        email ?? null,
        userAgent,
        JSON.stringify(getSerializableDetails(details)),
      ]
    );
  } catch (persistError) {
    console.error(
      `[auth-guard:log-error] ${JSON.stringify({
        eventType,
        action,
        code,
        ipAddress,
        email: email ?? null,
      })}`,
      persistError
    );
  }
}

function validateHumanChallenge(
  body: Record<string, unknown>,
  action: AuthGuardAction
) {
  const honeypot = getString(body.website);

  if (honeypot) {
    throw new AuthGuardError("Похоже на автоматический запрос. Попробуйте еще раз.", {
      code: "honeypot_triggered",
    });
  }

  const startedAt = Number(body.startedAt);

  if (!Number.isFinite(startedAt)) {
    throw new AuthGuardError(
      "Не удалось подтвердить запрос. Обновите страницу и попробуйте снова.",
      {
        code: "missing_started_at",
      }
    );
  }

  const ageMs = Date.now() - startedAt;

  if (ageMs < -MAX_FUTURE_CLOCK_SKEW_MS) {
    throw new AuthGuardError(
      "Часы на устройстве сильно отличаются от времени сервера. Проверьте время и попробуйте снова.",
      {
        code: "client_clock_skew",
        details: { ageMs },
      }
    );
  }

  if (ageMs > MAX_FORM_AGE_MS) {
    throw new AuthGuardError("Форма устарела. Обновите страницу и попробуйте снова.", {
      code: "stale_form",
      details: { ageMs },
    });
  }

  if (guardPolicies[action].minFillMs > 0 && ageMs < guardPolicies[action].minFillMs) {
    throw new AuthGuardError(
      "Слишком быстрый запрос. Подождите секунду и попробуйте снова.",
      {
        code: "submitted_too_fast",
        details: {
          ageMs,
          minFillMs: guardPolicies[action].minFillMs,
        },
      }
    );
  }
}

async function ensureAuthGuardSchema() {
  if (!authGuardSchemaPromise) {
    authGuardSchemaPromise = pool.query(AUTH_GUARD_SCHEMA_SQL).then(() => undefined);
  }

  try {
    await authGuardSchemaPromise;
  } catch (error) {
    authGuardSchemaPromise = null;
    throw error;
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
  await ensureAuthGuardSchema();

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
    throw new AuthGuardError(policy.ipMessage, {
      status: 429,
      code: "rate_limit_ip",
      details: {
        ipCount,
        ipLimit: policy.ipLimit,
        ipWindowSec: policy.ipWindowSec,
      },
    });
  }

  if (
    email &&
    policy.emailLimit &&
    policy.emailMessage &&
    emailCount > policy.emailLimit
  ) {
    throw new AuthGuardError(policy.emailMessage, {
      status: 429,
      code: "rate_limit_email",
      details: {
        emailCount,
        emailLimit: policy.emailLimit,
        emailWindowSec: policy.emailWindowSec,
      },
    });
  }
}

async function proxyToBetterAuth(
  request: NextRequest,
  path: string,
  payload: Record<string, unknown>
) {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");

  const internalRequest = new NextRequest(
    new Request(new URL(`/api/auth${path}`, request.url), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })
  );

  const response = await authHandlers.POST(internalRequest);
  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");

  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  const location = response.headers.get("location");

  if (location) {
    responseHeaders.set("location", location);
  }

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", cookie);
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function handleGuardedAuthRequest<TPayload extends Record<string, unknown>>(
  request: NextRequest,
  config: GuardRouteConfig<TPayload>
) {
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);
  let emailForLog: string | undefined;

  try {
    const rawBody = asRecord(await request.json());
    emailForLog = getEmailForLog(rawBody.email);

    validateHumanChallenge(rawBody, config.action);

    const payload = config.validate(rawBody, request);
    const email =
      typeof payload.email === "string" && payload.email ? payload.email : undefined;

    if (email) {
      emailForLog = email;
    }

    await applyRateLimit({
      action: config.action,
      ipAddress,
      email,
    });

    return await proxyToBetterAuth(request, config.targetPath, payload);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      logAuthGuardBlock({
        action: config.action,
        ipAddress,
        email: emailForLog,
        userAgent,
        error,
      });

      await persistAuthGuardLog({
        eventType: "block",
        action: config.action,
        code: error.code,
        reason: error.message,
        status: error.status,
        ipAddress,
        email: emailForLog,
        userAgent,
        details: error.details,
      });

      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const unexpectedReason =
      error instanceof Error ? error.message : "Unknown auth guard error";
    const unexpectedDetails =
      error instanceof Error
        ? {
            errorName: error.name,
            stack: error.stack?.split("\n").slice(0, 4).join("\n") ?? null,
          }
        : {
            rawError: String(error),
          };

    console.error(
      `[auth-guard:error] ${JSON.stringify({
        action: config.action,
        ipAddress,
        email: emailForLog ?? null,
        userAgent,
      })}`,
      error
    );

    await persistAuthGuardLog({
      eventType: "error",
      action: config.action,
      code: "unexpected_error",
      reason: unexpectedReason,
      status: 500,
      ipAddress,
      email: emailForLog,
      userAgent,
      details: unexpectedDetails,
    });

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
    throw new AuthGuardError("Введите пароль.", {
      code: "missing_password",
    });
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
    throw new AuthGuardError("Ссылка для сброса пароля недействительна.", {
      code: "missing_reset_token",
    });
  }

  validatePasswordStrength(newPassword);

  return {
    token,
    newPassword,
  };
}
