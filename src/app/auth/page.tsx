import { redirect } from "next/navigation";
import { BookOpenText, NotebookTabs, ShieldCheck } from "lucide-react";
import { AuthForms } from "@/components/auth/auth-forms";
import { KnowledgeLogo } from "@/components/brand/knowledge-logo";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AuthPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1480px] overflow-hidden rounded-[32px] border border-slate-300 bg-[#e9edf3]/96 shadow-[0_30px_90px_rgba(15,23,42,0.12)] lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
        <section className="flex flex-col justify-between border-b border-slate-300 bg-[#dde5ee] p-6 lg:border-b-0 lg:border-r lg:p-8 xl:p-10">
          <div>
            <KnowledgeLogo subtitle="Вход в личную базу знаний" />

            <div className="mt-12 space-y-5">
              <span className="inline-flex rounded-full border border-[#9fb8c9] bg-[#edf2f7] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3d6178]">
                auth
              </span>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Р’С…РѕРґ Рё СЂРµРіРёСЃС‚СЂР°С†РёСЏ Р±РµР· Р»РёС€РЅРёС… С€Р°РіРѕРІ.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                РћРґРёРЅ СЌРєСЂР°РЅ РґР»СЏ РІС…РѕРґР°, СЂРµРіРёСЃС‚СЂР°С†РёРё Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РїР°СЂРѕР»СЏ. РџРѕСЃР»Рµ Р°РІС‚РѕСЂРёР·Р°С†РёРё РІС‹
                СЃСЂР°Р·Сѓ РїРѕРїР°РґР°РµС‚Рµ РІ СЃРІРѕРё СЃС‚Р°С‚СЊРё Рё РјРѕР¶РµС‚Рµ РїСЂРѕРґРѕР»Р¶Р°С‚СЊ СЂР°Р±РѕС‚Сѓ.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[22px] border border-slate-300 bg-[#f3f6fa] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#dbeaf4] text-[#3b82a4]">
                <NotebookTabs className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">РЎС‚Р°С‚СЊРё РїРѕ С‚РµРјР°Рј</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Linux, Docker, СЃРµС‚Рё, Terraform Рё РґСЂСѓРіРёРµ СЂР°Р·РґРµР»С‹ СЃРѕР±СЂР°РЅС‹ РІ РµРґРёРЅРѕР№ СЃС‚СЂСѓРєС‚СѓСЂРµ.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-300 bg-[#f3f6fa] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#dbeaf4] text-[#3b82a4]">
                <BookOpenText className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Р§С‚РµРЅРёРµ СЂСЏРґРѕРј</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Р’С‹Р±РёСЂР°РµС‚Рµ СЃС‚Р°С‚СЊСЋ РІ СЃРїРёСЃРєРµ Рё СЃСЂР°Р·Сѓ РІРёРґРёС‚Рµ РєРѕРЅС‚РµРЅС‚, Р±РµР· РїРµСЂРµС…РѕРґРѕРІ РїРѕ РѕС‚РґРµР»СЊРЅС‹Рј
                СЃС‚СЂР°РЅРёС†Р°Рј.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-300 bg-[#f3f6fa] p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#dbeaf4] text-[#3b82a4]">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">РќР°РґРµР¶РЅС‹Р№ РґРѕСЃС‚СѓРї</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                РђРєРєР°СѓРЅС‚С‹ Рё СЃРµСЃСЃРёРё С…СЂР°РЅСЏС‚СЃСЏ РІ PostgreSQL, РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ email Рё СЃР±СЂРѕСЃ РїР°СЂРѕР»СЏ СѓР¶Рµ
                РїРѕРґРєР»СЋС‡РµРЅС‹.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center p-5 lg:p-8 xl:p-10">
          <AuthForms />
        </section>
      </main>
    </div>
  );
}


