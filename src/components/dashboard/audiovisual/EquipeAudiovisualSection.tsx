import { getEquipeAudiovisual } from "@/lib/dashboard/audiovisual";
import { PeriodoSelector } from "@/components/dashboard/personal/PeriodoSelector";
import type { Periodo } from "@/lib/dashboard/personal";
import { Video, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  periodo: Periodo;
}

function roleLabel(role: string): string {
  if (role === "videomaker") return "Videomaker";
  if (role === "audiovisual_chefe") return "Audiovisual chefe";
  if (role === "editor") return "Editor";
  return role;
}

export async function EquipeAudiovisualSection({ periodo }: Props) {
  const { videomakers, editores, agregados } = await getEquipeAudiovisual(periodo);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
          Visão da equipe
        </h2>
        <PeriodoSelector current={periodo} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Video className="h-3.5 w-3.5" /> Próximas gravações
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalGravacoesProximas}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluídas no período
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalConcluidasNoPeriodo}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" /> Pendentes (edição)
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalPendentes}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Videomakers</h3>
        {videomakers.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhum videomaker ativo na equipe.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-right font-medium">Próximas gravações</th>
                  <th className="px-3 py-2 text-right font-medium">Concluídas no período</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {videomakers.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{v.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.proximasGravacoes}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.concluidasNoPeriodo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Edição</h3>
        <p className="text-xs text-muted-foreground">
          Inclui editores, videomakers e audiovisual chefe que estão fazendo edição em tarefas.
        </p>
        {editores.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Ninguém com tarefas de edição no momento.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-left font-medium">Função</th>
                  <th className="px-3 py-2 text-right font-medium">Pendentes</th>
                  <th className="px-3 py-2 text-right font-medium">Concluídas no período</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {editores.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{e.nome}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{roleLabel(e.role)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.pendentes}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.concluidasNoPeriodo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
