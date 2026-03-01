type MailTemplateInput = {
  name?: string | null;
  email: string;
  url: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildShell({
  eyebrow,
  title,
  body,
  actionLabel,
  actionUrl,
  footnote,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  footnote: string;
}) {
  return `
    <div style="margin:0;padding:32px 16px;background:#eef7f1;font-family:Inter,Arial,sans-serif;color:#163528;">
      <div style="max-width:560px;margin:0 auto;border:1px solid #d8eade;border-radius:28px;overflow:hidden;background:#ffffff;box-shadow:0 18px 50px rgba(64,111,87,0.12);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#effaf0 0%,#d9f0e2 100%);border-bottom:1px solid #d8eade;">
          <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#ffffff;color:#3f6b52;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">
            ${escapeHtml(eyebrow)}
          </div>
          <h1 style="margin:18px 0 0;font-size:30px;line-height:1.1;font-weight:700;color:#163528;">
            ${escapeHtml(title)}
          </h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#355646;">
            ${body}
          </p>
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:8px;padding:14px 20px;border-radius:16px;background:#5ca36b;color:#ffffff;text-decoration:none;font-weight:700;">
            ${escapeHtml(actionLabel)}
          </a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#587565;">
            ${escapeHtml(footnote)}
          </p>
        </div>
      </div>
    </div>
  `;
}

export function getVerificationEmailTemplate({
  name,
  email,
  url,
}: MailTemplateInput) {
  const greeting = name?.trim() ? `Привет, ${escapeHtml(name)}.` : "Привет.";

  return {
    subject: "Подтвердите email для «Контур Знаний»",
    text: `${greeting}

Подтвердите адрес ${email}, чтобы активировать аккаунт в «Контур Знаний»:
${url}

Если вы не создавали аккаунт, просто проигнорируйте это письмо.`,
    html: buildShell({
      eyebrow: "Контур Знаний Auth",
      title: "Подтвердите ваш email",
      body: `${greeting} Для входа в «Контур Знаний» нужно подтвердить адрес <strong>${escapeHtml(
        email
      )}</strong>. После подтверждения вы сразу попадете в рабочее пространство.`,
      actionLabel: "Подтвердить email",
      actionUrl: url,
      footnote:
        "Если вы не создавали аккаунт в «Контур Знаний», просто проигнорируйте это письмо.",
    }),
  };
}

export function getResetPasswordEmailTemplate({
  name,
  email,
  url,
}: MailTemplateInput) {
  const greeting = name?.trim() ? `Привет, ${escapeHtml(name)}.` : "Привет.";

  return {
    subject: "Сброс пароля для «Контур Знаний»",
    text: `${greeting}

Мы получили запрос на смену пароля для ${email}.
Откройте ссылку, чтобы задать новый пароль:
${url}

Если это были не вы, просто проигнорируйте письмо.`,
    html: buildShell({
      eyebrow: "Контур Знаний Security",
      title: "Сброс пароля",
      body: `${greeting} Мы получили запрос на смену пароля для <strong>${escapeHtml(
        email
      )}</strong>. Откройте ссылку ниже и задайте новый пароль.`,
      actionLabel: "Задать новый пароль",
      actionUrl: url,
      footnote:
        "Если вы не запрашивали сброс пароля, ничего делать не нужно. Текущий пароль останется активным.",
    }),
  };
}

export function getRegistrationApprovedEmailTemplate({
  name,
  email,
  url,
}: MailTemplateInput) {
  const greeting = name?.trim() ? `Привет, ${escapeHtml(name)}.` : "Привет.";

  return {
    subject: "Заявка одобрена в «Контур Знаний»",
    text: `${greeting}

Ваша заявка на регистрацию (${email}) одобрена.
Теперь вы можете войти в «Контур Знаний»:
${url}

Если это не вы, ответьте на это письмо или свяжитесь с администратором.`,
    html: buildShell({
      eyebrow: "Контур Знаний Moderation",
      title: "Заявка одобрена",
      body: `${greeting} Ваша заявка для <strong>${escapeHtml(
        email
      )}</strong> одобрена. Можно входить и начинать работу с базой знаний.`,
      actionLabel: "Перейти ко входу",
      actionUrl: url,
      footnote:
        "Если вы не отправляли заявку, ответьте на это письмо или свяжитесь с администратором.",
    }),
  };
}

export function getRegistrationRejectedEmailTemplate({
  name,
  email,
  url,
}: MailTemplateInput) {
  const greeting = name?.trim() ? `Привет, ${escapeHtml(name)}.` : "Привет.";

  return {
    subject: "Заявка отклонена в «Контур Знаний»",
    text: `${greeting}

Ваша заявка на регистрацию (${email}) отклонена модератором.
Если это ошибка, отправьте заявку заново или свяжитесь с администратором:
${url}`,
    html: buildShell({
      eyebrow: "Контур Знаний Moderation",
      title: "Заявка отклонена",
      body: `${greeting} Заявка для <strong>${escapeHtml(
        email
      )}</strong> отклонена. Если это ошибка, можно отправить новую заявку.`,
      actionLabel: "Открыть страницу входа",
      actionUrl: url,
      footnote:
        "Если вы считаете решение ошибкой, напишите администратору и запросите повторную проверку.",
    }),
  };
}
