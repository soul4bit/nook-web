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
    <div className="min-h-screen bg-[#edf1f4] px-3 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-[1520px]">
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
