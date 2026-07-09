import { listMeusBloqueios } from "@/lib/audiovisual/bloqueios/queries";
import { SolicitarBloqueioModal } from "./SolicitarBloqueioModal";
import { CancelarBloqueioButton } from "./CancelarBloqueioButton";
import { Card } from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  pendente: "⏳ Pendente", aprovada: "✅ Aprovado", rejeitada: "❌ Recusado",
};
function fmt(d: string) { const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; }

export async function MeusBloqueiosAba({ userId }: { userId: string }) {
  const rows = await listMeusBloqueios(userId);
  return (
    <div className="space-y-4">
      <SolicitarBloqueioModal />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((b) => (
            <Card key={b.id} className="p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{fmt(b.data)} · {b.hora_inicio.slice(0,5)}–{b.hora_fim.slice(0,5)}</p>
                  <p className="text-muted-foreground">{b.motivo}</p>
                  {b.status === "rejeitada" && b.motivo_recusa && (
                    <p className="mt-1 text-destructive">Motivo da recusa: {b.motivo_recusa}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span>{STATUS_LABEL[b.status]}</span>
                  {b.status === "pendente" && <CancelarBloqueioButton id={b.id} />}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
