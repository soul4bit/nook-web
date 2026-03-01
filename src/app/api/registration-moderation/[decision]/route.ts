import { NextResponse } from "next/server";
import { reviewPendingRegistrationByToken } from "@/lib/auth/registration-approval";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    decision: string;
  }>;
};

function renderHtml(title: string, body: string, status = 200) {
  return new NextResponse(
    `
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>${title}</title>
          <style>
            body {
              margin: 0;
              font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
              color: #dbe7f3;
              background:
                radial-gradient(circle at 10% 10%, rgba(33, 192, 161, 0.18), transparent 36%),
                radial-gradient(circle at 90% 80%, rgba(61, 126, 201, 0.2), transparent 34%),
                linear-gradient(180deg, #04090e 0%, #09121a 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 24px;
            }
            .card {
              max-width: 720px;
              width: 100%;
              border: 1px solid #2a3847;
              border-radius: 22px;
              background: #111a24;
              padding: 28px;
              box-shadow: 0 24px 70px rgba(2, 8, 15, 0.55);
            }
            h1 {
              margin: 0 0 10px;
              font-size: 24px;
            }
            p {
              margin: 0;
              color: #94a6b8;
              line-height: 1.65;
            }
            .ok {
              color: #77e2cd;
            }
            .warn {
              color: #f7c273;
            }
            .error {
              color: #fda4af;
            }
          </style>
        </head>
        <body>
          <article class="card">
            <h1>${title}</h1>
            <p>${body}</p>
          </article>
        </body>
      </html>
    `,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    }
  );
}

export async function GET(request: Request, context: RouteContext) {
  const { decision } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  if (decision !== "approve" && decision !== "reject") {
    return renderHtml(
      "Некорректное действие",
      "Ссылка модерации содержит неизвестное действие.",
      400
    );
  }

  if (!token) {
    return renderHtml(
      "Отсутствует токен",
      "Ссылка модерации недействительна: отсутствует токен.",
      400
    );
  }

  try {
    const result = await reviewPendingRegistrationByToken({
      decision,
      token,
    });

    if (result.status === "not_found") {
      return renderHtml("Заявка не найдена", "Токен невалиден или заявка уже обработана.", 404);
    }

    const emailHint = result.notificationSent
      ? " Пользователь получил письмо с результатом."
      : " Письмо пользователю отправить не удалось, проверьте SMTP логи.";

    if (result.status === "rejected") {
      return renderHtml(
        "Заявка отклонена",
        `<span class="warn">Пользователь ${result.name} (${result.email}) отклонен.${emailHint}</span>`
      );
    }

    if (result.status === "approved_existing") {
      return renderHtml(
        "Заявка обработана",
        `<span class="warn">Аккаунт для ${result.email} уже существовал, заявка помечена как одобренная.${emailHint}</span>`
      );
    }

    return renderHtml(
      "Заявка одобрена",
      `<span class="ok">Пользователь ${result.name} (${result.email}) успешно создан.${emailHint}</span>`
    );
  } catch (error) {
    console.error("[registration-moderation:error]", error);
    return renderHtml(
      "Ошибка обработки",
      `<span class="error">Не удалось обработать заявку: ${
        error instanceof Error ? error.message : "unknown_error"
      }</span>`,
      500
    );
  }
}

