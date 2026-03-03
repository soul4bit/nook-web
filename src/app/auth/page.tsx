import { redirect } from "next/navigation";
import {
  Cloud,
  GitBranch,
  Layers3,
  Rocket,
  Server,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { AuthForms } from "@/components/auth/auth-forms";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AuthPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen px-3 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto grid w-full max-w-[1480px] gap-4 lg:grid-cols-[1.1fr_minmax(440px,0.9fr)]">
        <section className="nook-shell relative overflow-hidden rounded-[32px] p-6 lg:p-9 xl:p-10">
          <div className="nook-auth-glow nook-auth-glow-primary" />
          <div className="nook-auth-glow nook-auth-glow-secondary" />

          <KnowledgeLogo
            subtitle="Приватная база знаний команды"
            className="relative z-10"
            markClassName="border-slate-200 bg-white"
          />

          <div className="relative z-10 mt-8 flex min-h-[540px] items-center justify-center lg:mt-4">
            <article className="nook-devops-stage nook-auth-reveal-1" aria-hidden="true">
              <div className="nook-devops-grid" />
              <div className="nook-devops-scan" />
              <div className="nook-devops-orbit nook-devops-orbit-a" />
              <div className="nook-devops-orbit nook-devops-orbit-b" />

              <div className="nook-devops-core nook-auth-reveal-2">
                <TerminalSquare className="size-7 text-sky-300" />
              </div>

              <div className="nook-devops-pipeline">
                <div className="nook-devops-track" />
                <div className="nook-devops-progress" />
                <div className="nook-devops-packet" />
                <div className="nook-devops-packet nook-devops-packet-secondary" />

                <div className="nook-devops-node nook-devops-node-1">
                  <GitBranch className="size-5" />
                </div>
                <div className="nook-devops-node nook-devops-node-2">
                  <TerminalSquare className="size-5" />
                </div>
                <div className="nook-devops-node nook-devops-node-3">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="nook-devops-node nook-devops-node-4">
                  <Server className="size-5" />
                </div>
                <div className="nook-devops-node nook-devops-node-5">
                  <Rocket className="size-5" />
                </div>
              </div>

              <div className="nook-devops-status-strip nook-auth-reveal-3">
                <div className="nook-devops-status-chip">
                  <span className="nook-devops-status-dot" />
                  CI green
                </div>
                <div className="nook-devops-status-chip nook-devops-status-chip-alt">
                  <Layers3 className="size-3.5 text-cyan-300" />
                  CD live
                </div>
              </div>

              <div className="nook-devops-float nook-devops-float-left nook-auth-reveal-3">
                <Cloud className="size-5 text-cyan-300" />
              </div>
              <div className="nook-devops-float nook-devops-float-right nook-auth-reveal-4">
                <Server className="size-5 text-emerald-300" />
              </div>
              <div className="nook-devops-float nook-devops-float-bottom nook-auth-reveal-2">
                <ShieldCheck className="size-5 text-amber-300" />
              </div>
            </article>
          </div>
        </section>

        <section className="flex items-start lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:items-stretch">
          <AuthForms />
        </section>
      </main>
    </div>
  );
}
