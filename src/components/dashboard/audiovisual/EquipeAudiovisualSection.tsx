import { getEquipeAudiovisual } from "@/lib/dashboard/audiovisual";
import { PeriodoSelector } from "@/components/dashboard/personal/PeriodoSelector";
import type { Periodo } from "@/lib/dashboard/personal";
import { Video, CheckCircle2, Wrench, AlertTriangle } from "lucide-react";
import { MemberRow } from "./MemberRow";

interface Props {
  periodo: Periodo;
}

function roleLabel(role: string): string {
  if (role === "videomaker") return "Videomaker";
  if (role === "audiovisual_chefe") return "Coordenador audiovisual";
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

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Video className="h-3.5 w-3.5" /> Próximas gravações
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalGravacoesProximas}</p>
          <p className="text-xs text-muted-foreground">Hoje + futuro (2 semanas)</p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            agregados.totalAtrasadasEdicao > 0
              ? "border-rose-500/40 bg-rose-500/5"
              : "border bg-card"
          }`}
        >
          <div
            className={`flex items-center gap-2 text-xs uppercase tracking-wider ${
              agregados.totalAtrasadasEdicao > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-muted-foreground"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Edição atrasada
          </div>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              agregados.totalAtrasadasEdicao > 0 ? "text-rose-600 dark:text-rose-400" : ""
            }`}
          >
            {agregados.totalAtrasadasEdicao}
          </p>
          <p className="text-xs text-muted-foreground">Abertas com prazo vencido</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" /> Em andamento (edição)
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalEmAndamentoEdicao}</p>
          <p className="text-xs text-muted-foreground">Editores trabalhando agora</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluídas no período
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalConcluidasNoPeriodo}</p>
          <p className="text-xs text-muted-foreground">Capturas delegadas + edições finalizadas</p>
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
                  <th className="px-3 py-2 text-right font-medium">Próximas</th>
                  <th className="px-3 py-2 text-right font-medium">Hoje</th>
                  <th className="px-3 py-2 text-right font-medium">Concluídas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {videomakers.map((v) => (
                  <MemberRow
                    key={v.id}
                    variant="videomaker"
                    nome={v.nome}
                    proximas={v.proximas}
                    hoje={v.hoje}
                    concluidas={v.concluidas}
                    proximasList={v.proximasList}
                    hojeList={v.hojeList}
                    concluidasList={v.concluidasList}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Edição</h3>
        <p className="text-xs text-muted-foreground">
          Inclui editores, videomakers e coordenador audiovisual que estão fazendo edição em tarefas.
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
                  <th className="px-3 py-2 text-right font-medium text-rose-600 dark:text-rose-400">Atrasadas</th>
                  <th className="px-3 py-2 text-right font-medium">Próximas</th>
                  <th className="px-3 py-2 text-right font-medium">Em andamento</th>
                  <th className="px-3 py-2 text-right font-medium">Concluídas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {editores.map((e) => (
                  <MemberRow
                    key={e.id}
                    variant="edicao"
                    nome={e.nome}
                    funcao={roleLabel(e.role)}
                    atrasadas={e.atrasadas}
                    proximas={e.proximas}
                    emAndamento={e.emAndamento}
                    concluidas={e.concluidas}
                    atrasadasList={e.atrasadasList}
                    proximasList={e.proximasList}
                    emAndamentoList={e.emAndamentoList}
                    concluidasList={e.concluidasList}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
