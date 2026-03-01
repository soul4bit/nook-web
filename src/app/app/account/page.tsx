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
    <div className="min-h-screen px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <main className="mx-auto min-h-[calc(100vh-2rem)] max-w-[1480px] rounded-[32px] border border-slate-700/80 bg-[#0b141e]/95 p-5 shadow-[0_40px_120px_rgba(2,8,15,0.75)] lg:p-6 xl:p-8">
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
