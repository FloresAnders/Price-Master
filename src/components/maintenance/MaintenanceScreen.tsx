"use client";

import { Building2, Wrench } from "lucide-react";
import type { MaintenanceBlock } from "@/services/maintenance";

export default function MaintenanceScreen({
  block,
}: {
  block: MaintenanceBlock;
}) {
  const companyLabel =
    block.target.companyName || block.target.companyLocation || "Esta empresa";

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#020713] px-5 py-12 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.2),_transparent_48%)]" />
      <section className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/80 p-7 text-center shadow-2xl shadow-blue-950/40 backdrop-blur sm:p-10">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
          {block.scope === "company" ? (
            <Building2 className="h-10 w-10 text-blue-300" aria-hidden="true" />
          ) : (
            <Wrench className="h-10 w-10 text-blue-300" aria-hidden="true" />
          )}
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
          Time-Master
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {block.scope === "company"
            ? `${companyLabel} está en mantenimiento`
            : "Sistema en mantenimiento"}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-300 sm:text-lg">
          {block.target.message}
        </p>
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          El acceso se restaurará automáticamente
        </div>
      </section>
    </main>
  );
}
