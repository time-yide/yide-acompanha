import { Suspense } from "react";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CapturaForm } from "./CapturaForm";
import { CapturasOrganizadas } from "./CapturasOrganizadas";
import { AudiovisualToastFlash } from "./AudiovisualToastFlash";
import type { CapturaRow } from "@/lib/audiovisual/captura-utils";
import type { PendenteEvento } from "@/lib/audiovisual/queries";

interface Props {
  isVideomaker: boolean;
  canDelegate: boolean;
  pendentes: PendenteEvento[];
  clientes: Array<{ id: string; nome: string }>;
  capturas: CapturaRow[];
  editores: Array<{ id: string; nome: string }>;
}

export function CapturasAba({
  isVideomaker,
  canDelegate,
  pendentes,
  clientes,
  capturas,
  editores,
}: Props) {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <AudiovisualToastFlash />
      </Suspense>

      {isVideomaker && pendentes.length > 0 && (
        <Card className="space-y-2 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4" />
            Gravações pendentes de entrega ({pendentes.length})
          </h2>
          <ul className="space-y-1.5 text-xs">
            {pendentes.map((p) => (
              <li key={p.event_id} className="flex flex-wrap items-center gap-2">
                <span className={p.isOverdue ? "font-semibold text-destructive" : "text-muted-foreground"}>
                  {new Date(p.inicio).toLocaleDateString("pt-BR")} · {p.titulo}
                  {p.client_nome ? ` · ${p.client_nome}` : ""}
                </span>
                {p.isOverdue && (
                  <span className="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    ATRASADA
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isVideomaker && <CapturaForm clientes={clientes} pendentes={pendentes} />}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
          {isVideomaker ? "Minhas captações" : "Captações da equipe"}
          <span className="ml-1 text-xs font-normal text-muted-foreground">({capturas.length})</span>
        </h2>
        <CapturasOrganizadas
          capturas={capturas}
          showVideomaker={!isVideomaker}
          editores={editores}
          canDelegate={canDelegate}
        />
      </section>
    </div>
  );
}
