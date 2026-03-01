import nodemailer from "nodemailer";
import { APIError } from "better-call";
import { getMailEnv } from "./env";
import {
  getRegistrationApprovedEmailTemplate,
  getRegistrationRejectedEmailTemplate,
  getResetPasswordEmailTemplate,
  getVerificationEmailTemplate,
} from "./templates";

type MailTransport = {
  sendMail(options: unknown): Promise<unknown>;
};

let cachedTransporter: MailTransport | null = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  let env: ReturnType<typeof getMailEnv>;

  try {
    env = getMailEnv();
  } catch {
    throw new APIError("BAD_REQUEST", {
      message:
        "Почта для регистрации не настроена. Проверьте SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD и MAIL_FROM.",
    });
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.secure,
    auth: {
      user: env.user,
      pass: env.password,
    },
  });

  return cachedTransporter;
}

async function sendMail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  try {
    const transporter = getTransporter();
    const env = getMailEnv();

    await transporter.sendMail({
      from: env.from,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "unknown_smtp_error";

    throw new APIError("BAD_GATEWAY", {
      message: `Не удалось отправить письмо подтверждения. Проверьте SMTP настройки: ${message}`,
    });
  }
}

export async function sendVerificationEmail(input: {
  email: string;
  name?: string | null;
  url: string;
}) {
  const template = getVerificationEmailTemplate(input);

  await sendMail({
    to: input.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendResetPasswordEmail(input: {
  email: string;
  name?: string | null;
  url: string;
}) {
  const template = getResetPasswordEmailTemplate(input);

  await sendMail({
    to: input.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendRegistrationApprovedEmail(input: {
  email: string;
  name?: string | null;
  url: string;
}) {
  const template = getRegistrationApprovedEmailTemplate(input);

  await sendMail({
    to: input.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendRegistrationRejectedEmail(input: {
  email: string;
  name?: string | null;
  url: string;
}) {
  const template = getRegistrationRejectedEmailTemplate(input);

  await sendMail({
    to: input.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}
