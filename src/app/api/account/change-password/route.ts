import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getPasswordChangeStatus, markPasswordChanged } from "@/lib/account/server";

export const runtime = "nodejs";

function jsonMessage(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return jsonMessage("Нужна авторизация.", 401);
  }

  const passwordStatus = await getPasswordChangeStatus(session.user.id);

  if (!passwordStatus.canChange && passwordStatus.nextAllowedAt) {
    return jsonMessage(
      `Пароль можно менять не чаще одного раза в 24 часа. Следующая смена будет доступна ${formatDateTime(passwordStatus.nextAllowedAt)}.`,
      429
    );
  }

  const body = await request.text();
  const url = new URL("/api/auth/change-password", request.url);
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body,
  });

  const responseBody = await upstream.text();
  const setCookie = upstream.headers.get("set-cookie");

  if (!upstream.ok) {
    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        ...(setCookie ? { "set-cookie": setCookie } : {}),
      },
    });
  }

  const changedAt = await markPasswordChanged(session.user.id);
  const payload = responseBody ? JSON.parse(responseBody) : {};

  return NextResponse.json(
    {
      ...payload,
      nextAllowedAt: changedAt.toISOString(),
    },
    {
      status: upstream.status,
      headers: setCookie ? { "set-cookie": setCookie } : undefined,
    }
  );
}
