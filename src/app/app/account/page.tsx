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
    <div className="min-h-screen bg-[#121514] px-4 py-4 text-[#f3f7f4] sm:px-6 lg:px-8">
      <main className="mx-auto min-h-[calc(100vh-2rem)] max-w-[1480px] rounded-[36px] border border-[#29312d] bg-[radial-gradient(circle_at_top_left,rgba(83,230,166,0.16),transparent_28%),linear-gradient(180deg,#181c1a_0%,#111413_100%)] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.45)] lg:p-6 xl:p-8">
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
