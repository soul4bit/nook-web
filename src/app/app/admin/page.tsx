import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  Mail,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCog,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user/user-avatar";
import {
  listPendingRegistrationRequests,
  reviewPendingRegistrationById,
} from "@/lib/auth/registration-approval";
import {
  adminBanUser,
  adminRemoveUser,
  adminRevokeUserSessions,
  adminSetUserRole,
  adminUnbanUser,
  listAdminUsers,
} from "@/lib/auth/admin";
import { getCurrentSession, isAdminSession } from "@/lib/auth/session";

type NoticeTone = "success" | "error" | "info";

type AdminPageProps = {
  searchParams?: Promise<{
    notice?: string;
    tone?: string;
  }>;
};

function getNoticeTone(value: string | undefined): NoticeTone {
  if (value === "success" || value === "error" || value === "info") {
    return value;
  }

  return "info";
}

function getNoticeClassName(tone: NoticeTone) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (tone === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-sky-200 bg-sky-50 text-sky-700";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Нет данных";
  }

  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildAdminHref(notice: string, tone: NoticeTone) {
  const params = new URLSearchParams({
    notice,
    tone,
  });

  return `/app/admin?${params.toString()}`;
}

function getAdminActionError(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "unknown_error";

  if (message.includes("YOU_CANNOT_REMOVE_YOURSELF")) {
    return "Нельзя удалить собственный аккаунт администратора.";
  }

  if (message.includes("YOU_CANNOT_BAN_YOURSELF")) {
    return "Нельзя заблокировать самого себя.";
  }

  if (message.includes("YOU_ARE_NOT_ALLOWED")) {
    return "Недостаточно прав для этого действия.";
  }

  if (message.includes("User not found") || message.includes("USER_NOT_FOUND")) {
    return "Пользователь не найден.";
  }

  return "Не удалось выполнить админ-действие. Проверьте серверные логи.";
}

async function reviewPendingRequestAction(formData: FormData) {
  "use server";

  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth");
  }

  if (!isAdminSession(session)) {
    redirect("/app");
  }

  const rawRequestId = formData.get("requestId");
  const rawDecision = formData.get("decision");
  const requestId = typeof rawRequestId === "string" ? rawRequestId.trim() : "";
  const decision = rawDecision === "approve" || rawDecision === "reject" ? rawDecision : null;

  if (!requestId || !decision) {
    redirect(buildAdminHref("Некорректные параметры заявки.", "error"));
  }

  let notice = "";
  let tone: NoticeTone = "success";

  try {
    const result = await reviewPendingRegistrationById({
      decision,
      id: requestId,
      reviewedBy: `admin:${session.user.email}`,
    });

    if (result.status === "not_found") {
      notice = "Заявка уже обработана или не найдена.";
      tone = "info";
    } else {
      const notificationPart = result.notificationSent
        ? " Пользователь получил письмо с решением."
        : " Письмо отправить не удалось, проверьте SMTP.";
      const actionText = decision === "approve" ? "Заявка одобрена." : "Заявка отклонена.";
      notice = `${actionText}${notificationPart}`;
      tone = "success";
    }
  } catch (error) {
    console.error("[admin:pending:review:error]", error);
    notice = "Не удалось обработать заявку.";
    tone = "error";
  }

  revalidatePath("/app/admin");
  redirect(buildAdminHref(notice, tone));
}

async function manageUserAction(formData: FormData) {
  "use server";

  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth");
  }

  if (!isAdminSession(session)) {
    redirect("/app");
  }

  const rawUserId = formData.get("userId");
  const rawAction = formData.get("action");
  const userId = typeof rawUserId === "string" ? rawUserId.trim() : "";
  const action = typeof rawAction === "string" ? rawAction.trim() : "";

  if (!userId || !action) {
    redirect(buildAdminHref("Некорректные параметры пользователя.", "error"));
  }

  if (
    userId === session.user.id &&
    (action === "delete" || action === "demote" || action === "ban")
  ) {
    redirect(buildAdminHref("Это действие нельзя применять к своему аккаунту.", "error"));
  }

  let notice = "";
  let tone: NoticeTone = "success";

  try {
    switch (action) {
      case "promote":
        await adminSetUserRole(userId, "admin");
        notice = "Пользователь получил роль admin.";
        break;
      case "demote":
        await adminSetUserRole(userId, "user");
        notice = "Права администратора сняты.";
        break;
      case "ban":
        await adminBanUser(userId, "Заблокирован администратором через панель управления.");
        notice = "Пользователь заблокирован.";
        break;
      case "unban":
        await adminUnbanUser(userId);
        notice = "Пользователь разблокирован.";
        break;
      case "revoke_sessions":
        await adminRevokeUserSessions(userId);
        notice = "Все сессии пользователя завершены.";
        break;
      case "delete":
        await adminRemoveUser(userId);
        notice = "Аккаунт пользователя удален.";
        break;
      default:
        notice = "Неизвестное действие.";
        tone = "error";
    }
  } catch (error) {
    console.error("[admin:user:action:error]", error);
    notice = getAdminActionError(error);
    tone = "error";
  }

  revalidatePath("/app/admin");
  redirect(buildAdminHref(notice, tone));
}

export default async function AdminRegistrationPage({ searchParams }: AdminPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth");
  }

  if (!isAdminSession(session)) {
    redirect("/app");
  }

  const params = searchParams ? await searchParams : undefined;
  const notice = params?.notice?.trim() || null;
  const tone = getNoticeTone(params?.tone);
  const pendingRequests = await listPendingRegistrationRequests(250);
  const { users, total } = await listAdminUsers(500);

  return (
    <div className="min-h-screen bg-[#edf1f4] px-3 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-[1520px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Администрирование
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Управление доступом и пользователями
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Здесь можно модерировать заявки на регистрацию, управлять ролями, блокировками,
              активными сессиями и удалением аккаунтов.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          >
            <Link href="/app">
              <ArrowLeft className="size-4" />
              Назад к статьям
            </Link>
          </Button>
        </div>

        {notice ? (
          <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm shadow-sm ${getNoticeClassName(tone)}`}>
            {notice}
          </div>
        ) : null}

        <section className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700">
            <Clock3 className="size-3.5 text-sky-700" />
            Заявок в очереди: {pendingRequests.length}
          </div>

          {pendingRequests.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <ShieldAlert className="mx-auto size-10 text-slate-500" />
              <h2 className="mt-4 text-xl font-semibold text-slate-900">Открытых заявок нет</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Когда появятся новые регистрации, они отобразятся в этом списке.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{request.name}</h2>
                      <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-700">
                        <Mail className="size-4 text-sky-700" />
                        {request.email}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(request.requestedAt)}</p>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-300 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">IP</p>
                      <p className="mt-1 text-slate-700">{request.requestIp}</p>
                    </div>
                    <div className="rounded-xl border border-slate-300 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        User-Agent
                      </p>
                      <p className="mt-1 break-all text-slate-700">{request.userAgent}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <form action={reviewPendingRequestAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <Button
                        type="submit"
                        className="rounded-xl"
                      >
                        <CheckCircle2 className="size-4" />
                        Одобрить
                      </Button>
                    </form>

                    <form action={reviewPendingRequestAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <Button type="submit" variant="destructive" className="rounded-xl">
                        <XCircle className="size-4" />
                        Отклонить
                      </Button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700">
            <UserCog className="size-3.5 text-sky-700" />
            Пользователей: {total}
          </div>

          <div className="space-y-4">
            {users.map((user) => {
              const isCurrentUser = user.id === session.user.id;
              const isAdmin = user.role.split(",").includes("admin");

              return (
                <article
                  key={user.id}
                  className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        image={user.image}
                        name={user.name}
                        className="size-12 rounded-xl border border-slate-300 bg-white"
                        fallbackClassName="text-sky-700"
                      />
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-600">{user.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-700">
                            role: {user.role}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 ${
                              user.emailVerified
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                            }`}
                          >
                            {user.emailVerified ? "email подтвержден" : "email не подтвержден"}
                          </span>
                          {user.banned ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">
                              заблокирован
                            </span>
                          ) : (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
                              активен
                            </span>
                          )}
                          {isCurrentUser ? (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
                              вы
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-300 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Создан</p>
                      <p className="mt-1 text-slate-700">{formatDateTime(user.createdAt)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-300 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Последний актив
                      </p>
                      <p className="mt-1 text-slate-700">{formatDateTime(user.lastActiveAt)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-300 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Активных сессий
                      </p>
                      <p className="mt-1 text-slate-700">{user.activeSessions}</p>
                    </div>
                    <div className="rounded-xl border border-slate-300 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">ID</p>
                      <p className="mt-1 break-all text-slate-700">{user.id}</p>
                    </div>
                  </div>

                  {user.banned && user.banReason ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      Причина блокировки: {user.banReason}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {isAdmin ? (
                      <form action={manageUserAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="action" value="demote" />
                        <Button
                          type="submit"
                          variant="outline"
                          className="rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          disabled={isCurrentUser}
                        >
                          <ShieldOff className="size-4" />
                          Снять admin
                        </Button>
                      </form>
                    ) : (
                      <form action={manageUserAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="action" value="promote" />
                        <Button
                          type="submit"
                          variant="outline"
                          className="rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        >
                          <ShieldCheck className="size-4" />
                          Сделать admin
                        </Button>
                      </form>
                    )}

                    {user.banned ? (
                      <form action={manageUserAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="action" value="unban" />
                        <Button
                          type="submit"
                          variant="outline"
                          className="rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        >
                          <CheckCircle2 className="size-4" />
                          Разблокировать
                        </Button>
                      </form>
                    ) : (
                      <form action={manageUserAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="action" value="ban" />
                        <Button
                          type="submit"
                          variant="outline"
                          className="rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          disabled={isCurrentUser}
                        >
                          <Ban className="size-4" />
                          Заблокировать
                        </Button>
                      </form>
                    )}

                    <form action={manageUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="action" value="revoke_sessions" />
                      <Button
                        type="submit"
                        variant="outline"
                        className="rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      >
                        <RefreshCcw className="size-4" />
                        Завершить сессии
                      </Button>
                    </form>

                    <form action={manageUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="action" value="delete" />
                      <Button
                        type="submit"
                        variant="destructive"
                        className="rounded-xl"
                        disabled={isCurrentUser}
                      >
                        <Trash2 className="size-4" />
                        Удалить аккаунт
                      </Button>
                    </form>
                  </div>
                </article>
              );
            })}

            {users.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                <UserRound className="mx-auto size-10 text-slate-500" />
                <h2 className="mt-4 text-xl font-semibold text-slate-900">Пользователи не найдены</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Пока в системе нет зарегистрированных пользователей.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
