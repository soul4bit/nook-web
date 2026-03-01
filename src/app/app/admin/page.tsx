import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Mail, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listPendingRegistrationRequests,
  reviewPendingRegistrationById,
} from "@/lib/auth/registration-approval";
import { getCurrentSession, isAdminSession } from "@/lib/auth/session";

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
  const decision =
    rawDecision === "approve" || rawDecision === "reject" ? rawDecision : null;

  if (!requestId || !decision) {
    return;
  }

  await reviewPendingRegistrationById({
    decision,
    id: requestId,
    reviewedBy: `admin:${session.user.email}`,
  });

  revalidatePath("/app/admin");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminRegistrationPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth");
  }

  if (!isAdminSession(session)) {
    redirect("/app");
  }

  const pendingRequests = await listPendingRegistrationRequests(250);

  return (
    <div className="min-h-screen px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <main className="mx-auto min-h-[calc(100vh-2rem)] max-w-[1480px] rounded-[32px] border border-slate-700/80 bg-[#0a131c]/95 p-5 shadow-[0_40px_120px_rgba(2,8,15,0.75)] lg:p-6 xl:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Администрирование
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">
              Заявки на регистрацию
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Здесь отображаются заявки со статусом pending. Можно одобрять и отклонять их
              вручную, помимо модерации из Telegram.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-slate-700/80 bg-[#132231] text-slate-300 hover:bg-[#162431]"
          >
            <Link href="/app">
              <ArrowLeft className="size-4" />
              Назад к статьям
            </Link>
          </Button>
        </div>

        <section className="mt-6 rounded-[24px] border border-slate-700/80 bg-[#111f2c]/85 p-4 sm:p-5">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-[#132231] px-3 py-1 text-xs text-slate-400">
            <Clock3 className="size-3.5 text-[#49d4b8]" />
            Pending: {pendingRequests.length}
          </div>

          {pendingRequests.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-slate-700/80 bg-[#0f1a25] px-5 py-10 text-center">
              <ShieldAlert className="mx-auto size-10 text-slate-500" />
              <h2 className="mt-4 text-xl font-semibold text-slate-100">
                Открытых заявок сейчас нет
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Когда появятся новые регистрации, они отобразятся в этом списке.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-[20px] border border-slate-700/80 bg-[#132231]/80 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100">{request.name}</h2>
                      <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-300">
                        <Mail className="size-4 text-[#49d4b8]" />
                        {request.email}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(request.requestedAt)}</p>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-700/80 bg-[#0f1a25] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">IP</p>
                      <p className="mt-1 text-slate-300">{request.requestIp}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-[#0f1a25] px-3 py-2">
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
                        className="rounded-xl bg-[#1e9f86] text-white hover:bg-[#1b8b75]"
                      >
                        <CheckCircle2 className="size-4" />
                        Одобрить
                      </Button>
                    </form>

                    <form action={reviewPendingRequestAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <Button
                        type="submit"
                        variant="destructive"
                        className="rounded-xl"
                      >
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
      </main>
    </div>
  );
}

