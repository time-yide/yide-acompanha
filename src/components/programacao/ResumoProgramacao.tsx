import { Cog, Layers, Plug, UserPlus, type LucideIcon } from "lucide-react";
import type { ResumoLancamentos } from "@/lib/programacao/resumo";

function StatCard({ icon: Icon, label, value, cor }: { icon: LucideIcon; label: string; value: number; cor: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${cor}`} />
      </div>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

export function ResumoProgramacao({ resumo }: { resumo: ResumoLancamentos }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard icon={Plug} cor="text-sky-400" label="CRM conectados" value={resumo.crm} />
      <StatCard icon={UserPlus} cor="text-emerald-400" label="Usuários criados" value={resumo.usuarios} />
      <StatCard icon={Cog} cor="text-violet-400" label="Sistemas feitos" value={resumo.sistemas} />
      <StatCard icon={Layers} cor="text-teal-300" label="Total no período" value={resumo.total} />
    </div>
  );
}
