import { listBloqueiosPendentes, listBloqueiosRespondidos } from "@/lib/audiovisual/bloqueios/queries";
import { AprovarBloqueioControls } from "./AprovarBloqueioControls";
import { Card } from "@/components/ui/card";

function fmt(d: string) { const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; }

export async function SolicitacoesBloqueioAba() {
  const [pendentes, respondidos] = await Promise.all([listBloqueiosPendentes(), listBloqueiosRespondidos()]);
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Pendentes</h3>
        {pendentes.length === 0 ? <p className="text-sm text-muted-foreground">Nada pendente.</p> :
          pendentes.map((b) => (
            <Card key={b.id} className="p-3 text-sm">
              <p className="font-medium">{b.criado_por_nome} · {fmt(b.data)} · {b.hora_inicio.slice(0,5)}–{b.hora_fim.slice(0,5)}</p>
              <p className="mb-2 text-muted-foreground">{b.motivo}</p>
              <AprovarBloqueioControls id={b.id} />
            </Card>
          ))}
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Histórico</h3>
        {respondidos.map((b) => (
          <Card key={b.id} className="p-2 text-xs text-muted-foreground">
            {b.criado_por_nome} · {fmt(b.data)} · {b.hora_inicio.slice(0,5)}–{b.hora_fim.slice(0,5)} — {b.status}
            {b.status === "rejeitada" && b.motivo_recusa ? ` (${b.motivo_recusa})` : ""}
          </Card>
        ))}
      </section>
    </div>
  );
}
