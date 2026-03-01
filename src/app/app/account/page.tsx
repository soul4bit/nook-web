import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/account/account-settings";
import { getPasswordChangeStatus } from "@/lib/account/server";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AccountPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth");
  }

  const passwordStatus = await getPasswordChangeStatus(session.user.id);

  return (
    <div className="min-h-screen px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto min-h-[calc(100vh-2rem)] max-w-[1480px] rounded-[32px] border border-slate-200 bg-[#f7f9fb]/95 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.08)] lg:p-6 xl:p-8">
        <AccountSettings
          user={{
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
            emailVerified: session.user.emailVerified,
          }}
          passwordStatus={{
            canChange: passwordStatus.canChange,
            nextAllowedAt: passwordStatus.canChange
              ? null
              : passwordStatus.nextAllowedAt?.toISOString() ?? null,
          }}
        />
      </main>
    </div>
  );
}
