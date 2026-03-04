import { redirect } from "next/navigation";
import { Compass, Database, Orbit, Route, Search, ShieldCheck, Waypoints } from "lucide-react";
import { AuthForms } from "@/components/auth/auth-forms";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { getCurrentSession } from "@/lib/auth/session";

const mapNodes = [
  { id: "source", label: "Черновики и заметки", top: 12, left: 14 },
  { id: "index", label: "Индексация", top: 42, left: 31 },
  { id: "route", label: "Связи между статьями", top: 67, left: 52 },
  { id: "lookup", label: "Поиск решения", top: 34, left: 67 },
  { id: "runbook", label: "Runbook для команды", top: 62, left: 81 },
] as const;

const stats = [
  { label: "Хранилище", value: "PostgreSQL", icon: Database },
  { label: "Навигация", value: "Wiki + FTS", icon: Search },
  { label: "Контроль", value: "Guard + Moderation", icon: ShieldCheck },
] as const;

const checkpoints = [
  {
    title: "Один живой атлас",
    text: "Контекст инцидентов, runbook и инфраструктурные заметки собраны в единую карту знаний.",
    icon: Orbit,
  },
  {
    title: "Быстрые маршруты к решению",
    text: "Инженер открывает нужную вершину графа и сразу получает рабочий ответ.",
    icon: Route,
  },
] as const;

export default async function AuthPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <main className="mx-auto grid w-full max-w-[1360px] gap-5 lg:grid-cols-[minmax(0,1.06fr)_minmax(440px,0.94fr)]">
        <section className="nook-shell rounded-3xl p-6 sm:p-8">
          <KnowledgeLogo subtitle="Knowledge Atlas для DevOps-команды" />

          <div className="mt-8 space-y-4">
            <span className="nook-kicker">
              <Compass className="size-3.5" />
              knowledge atlas
            </span>
            <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              Контур Знаний
              <br />
              как карта маршрутов, а не склад заметок.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Соберите разрозненные DevOps-знания в связный атлас: где каждая статья - это узел, а переход
              между узлами ведет к рабочему решению без хаоса в чатах.
            </p>
          </div>

          <section className="atlas-field mt-6 rounded-3xl p-5">
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Карта маршрута знаний
              </p>
              <div className="relative mt-4 h-[290px]">
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100">
                  <path d="M14 12 L31 42 L52 67 L67 34 L81 62" fill="none" stroke="rgba(50,88,177,0.44)" strokeWidth="0.9" />
                  <path d="M31 42 L67 34" fill="none" stroke="rgba(80,122,210,0.38)" strokeWidth="0.75" strokeDasharray="2.2 2" />
                  <path d="M52 67 L81 62" fill="none" stroke="rgba(64,100,186,0.36)" strokeWidth="0.7" />
                </svg>

                {mapNodes.map((node, index) => (
                  <div
                    key={node.id}
                    className={`atlas-node atlas-node-enter absolute w-40 -translate-x-1/2 -translate-y-1/2 px-3 py-2 text-xs font-semibold ${
                      index === 2 ? "atlas-node-active atlas-node-float" : ""
                    }`}
                    style={{
                      top: `${node.top}%`,
                      left: `${node.left}%`,
                      animationDelay: `${70 + index * 70}ms`,
                    }}
                  >
                    {node.label}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {stats.map((item) => (
              <article key={item.label} className="nook-panel-soft rounded-2xl px-4 py-3">
                <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <item.icon className="size-3.5" />
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {checkpoints.map((item) => (
              <article key={item.title} className="nook-panel rounded-2xl p-4">
                <div className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </div>
                <h2 className="mt-3 text-sm font-semibold text-foreground">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground">
            <Waypoints className="size-3.5 text-primary" />
            Атлас живет вместе с командой и обновляется в рабочем ритме.
          </div>
        </section>

        <section className="nook-shell rounded-3xl p-6 sm:p-8">
          <AuthForms />
        </section>
      </main>
    </div>
  );
}
