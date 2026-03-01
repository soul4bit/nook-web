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
    return "border-emerald-500/40 bg-emerald-950/30 text-emerald-300";
  }

  if (tone === "error") {
    return "border-rose-500/40 bg-rose-950/30 text-rose-300";
  }

  return "border-cyan-500/40 bg-cyan-950/30 text-cyan-300";
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

  try {
    const result = await reviewPendingRegistrationById({
      decision,
      id: requestId,
      reviewedBy: `admin:${session.user.email}`,
    });

    revalidatePath("/app/admin");

    if (result.status === "not_found") {
      redirect(buildAdminHref("Заявка уже обработана или не найдена.", "info"));
    }

    const notificationPart = result.notificationSent
      ? " Пользователь получил письмо с решением."
      : " Письмо отправить не удалось, проверьте SMTP.";
    const actionText = decision === "approve" ? "Заявка одобрена." : "Заявка отклонена.";

    redirect(buildAdminHref(`${actionText}${notificationPart}`, "success"));
  } catch (error) {
    console.error("[admin:pending:review:error]", error);
    redirect(buildAdminHref("Не удалось обработать заявку.", "error"));
  }
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

  try {
    switch (action) {
      case "promote":
        await adminSetUserRole(userId, "admin");
        redirect(buildAdminHref("Пользователь получил роль admin.", "success"));
      case "demote":
        await adminSetUserRole(userId, "user");
        redirect(buildAdminHref("Права администратора сняты.", "success"));
      case "ban":
        await adminBanUser(userId, "Заблокирован администратором через панель управления.");
        redirect(buildAdminHref("Пользователь заблокирован.", "success"));
      case "unban":
        await adminUnbanUser(userId);
        redirect(buildAdminHref("Пользователь разблокирован.", "success"));
      case "revoke_sessions":
        await adminRevokeUserSessions(userId);
        redirect(buildAdminHref("Все сессии пользователя завершены.", "success"));
      case "delete":
        await adminRemoveUser(userId);
        redirect(buildAdminHref("Аккаунт пользователя удален.", "success"));
      default:
        redirect(buildAdminHref("Неизвестное действие.", "error"));
    }
  } catch (error) {
    console.error("[admin:user:action:error]", error);
    redirect(buildAdminHref(getAdminActionError(error), "error"));
  } finally {
    revalidatePath("/app/admin");
  }
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
    <div className="min-h-screen px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <main className="mx-auto min-h-[calc(100vh-2rem)] max-w-[1480px] rounded-[32px] border border-slate-700/80 bg-[#0b141e]/95 p-5 shadow-[0_40px_120px_rgba(2,8,15,0.75)] lg:p-6 xl:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Администрирование
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">
              Управление доступом и пользователями
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Здесь можно модерировать заявки на регистрацию, управлять ролями, блокировками,
              активными сессиями и удалением аккаунтов.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-slate-700/80 bg-[#152638] text-slate-300 hover:bg-[#172a3b]"
          >
            <Link href="/app">
              <ArrowLeft className="size-4" />
              Назад к статьям
            </Link>
          </Button>
        </div>

        {notice ? (
          <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${getNoticeClassName(tone)}`}>
            {notice}
          </div>
        ) : null}

        <section className="mt-6 rounded-[24px] border border-slate-700/80 bg-[#132230]/85 p-4 sm:p-5">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-[#152638] px-3 py-1 text-xs text-slate-400">
            <Clock3 className="size-3.5 text-[#56e3c2]" />
            Заявок в очереди: {pendingRequests.length}
          </div>

          {pendingRequests.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-slate-700/80 bg-[#0f1b28] px-5 py-10 text-center">
              <ShieldAlert className="mx-auto size-10 text-slate-500" />
              <h2 className="mt-4 text-xl font-semibold text-slate-100">Открытых заявок нет</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Когда появятся новые регистрации, они отобразятся в этом списке.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-[20px] border border-slate-700/80 bg-[#152638]/80 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100">{request.name}</h2>
                      <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-300">
                        <Mail className="size-4 text-[#56e3c2]" />
                        {request.email}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(request.requestedAt)}</p>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-700/80 bg-[#0f1b28] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">IP</p>
                      <p className="mt-1 text-slate-300">{request.requestIp}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-[#0f1b28] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        User-Agent
                      </p>
                      <p className="mt-1 break-all text-slate-300">{request.userAgent}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <form action={reviewPendingRequestAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <Button
                        type="submit"
                        className="rounded-xl bg-[#21ab8f] text-white hover:bg-[#1b947d]"
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

        <section className="mt-6 rounded-[24px] border border-slate-700/80 bg-[#132230]/85 p-4 sm:p-5">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-[#152638] px-3 py-1 text-xs text-slate-400">
            <UserCog className="size-3.5 text-[#56e3c2]" />
            Пользователей: {total}
          </div>

          <div className="space-y-4">
            {users.map((user) => {
              const isCurrentUser = user.id === session.user.id;
              const isAdmin = user.role.split(",").includes("admin");

              return (
                <article
                  key={user.id}
                  className="rounded-[20px] border border-slate-700/80 bg-[#152638]/80 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        image={user.image}
                        name={user.name}
                        className="size-12 rounded-xl border-slate-600/70 bg-[#0f1b28]"
                        fallbackClassName="text-[#56e3c2]"
                      />
                      <div>
                        <p className="text-lg font-semibold text-slate-100">{user.name}</p>
                        <p className="text-sm text-slate-300">{user.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-slate-600/70 bg-[#0f1b28] px-2.5 py-1 text-slate-300">
                            role: {user.role}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 ${
                              user.emailVerified
                                ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
                                : "border-amber-500/40 bg-amber-950/30 text-amber-300"
                            }`}
                          >
                            {user.emailVerified ? "email подтвержден" : "email не подтвержден"}
                          </span>
                          {user.banned ? (
                            <span className="rounded-full border border-rose-500/40 bg-rose-950/30 px-2.5 py-1 text-rose-300">
                              заблокирован
                            </span>
                          ) : (
                            <span className="rounded-full border border-cyan-500/40 bg-cyan-950/30 px-2.5 py-1 text-cyan-300">
                              активен
                            </span>
                          )}
                          {isCurrentUser ? (
                            <span className="rounded-full border border-[#56e3c2]/40 bg-[#56e3c2]/10 px-2.5 py-1 text-[#56e3c2]">
                              вы
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-700/80 bg-[#0f1b28] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Создан</p>
                      <p className="mt-1 text-slate-300">{formatDateTime(user.createdAt)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-[#0f1b28] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Последний актив
                      </p>
                      <p className="mt-1 text-slate-300">{formatDateTime(user.lastActiveAt)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-[#0f1b28] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Активных сессий
                      </p>
                      <p className="mt-1 text-slate-300">{user.activeSessions}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-[#0f1b28] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">ID</p>
                      <p className="mt-1 break-all text-slate-300">{user.id}</p>
                    </div>
                  </div>

                  {user.banned && user.banReason ? (
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-sm text-rose-300">
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
                          className="rounded-xl border-slate-600/70 bg-[#172a3b] text-slate-200 hover:bg-[#1c3044]"
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
                          className="rounded-xl border-slate-600/70 bg-[#172a3b] text-slate-200 hover:bg-[#1c3044]"
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
                          className="rounded-xl border-slate-600/70 bg-[#172a3b] text-slate-200 hover:bg-[#1c3044]"
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
                          className="rounded-xl border-slate-600/70 bg-[#172a3b] text-slate-200 hover:bg-[#1c3044]"
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
                        className="rounded-xl border-slate-600/70 bg-[#172a3b] text-slate-200 hover:bg-[#1c3044]"
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
              <div className="rounded-[20px] border border-dashed border-slate-700/80 bg-[#0f1b28] px-5 py-10 text-center">
                <UserRound className="mx-auto size-10 text-slate-500" />
                <h2 className="mt-4 text-xl font-semibold text-slate-100">Пользователи не найдены</h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">
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
