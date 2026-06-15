import { ShieldAlert } from "lucide-react";
import { RecadoCard } from "./RecadoCard";
import type { PrivadoRow } from "@/lib/recados/privados";
import { destinatariosLabel, isAuditoriaSomente } from "@/lib/recados/privados";

interface Props {
  privados: PrivadoRow[];
  currentUserId: string;
  currentUserRole: string;
  emptyLabel: string;
}

export function PrivadoFeed({ privados, currentUserId, currentUserRole, emptyLabel }: Props) {
  if (privados.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  const isSocio = currentUserRole === "socio";
  const meus = privados.filter((r) => !isSocio || !isAuditoriaSomente(r, currentUserId));
  const auditoria = isSocio ? privados.filter((r) => isAuditoriaSomente(r, currentUserId)) : [];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="grid gap-3">
          {meus.map((r) => (
            <RecadoCard
              key={r.id}
              recado={r}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              destinatariosLabel={destinatariosLabel(r)}
            />
          ))}
          {meus.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum recado privado seu.
            </p>
          )}
        </div>
      </section>

      {auditoria.length > 0 && (
        <section className="space-y-3">
          <header className="flex items-center gap-2 rounded-md bg-sky-900 px-3 py-2 text-sm font-semibold text-white">
            <ShieldAlert className="h-4 w-4" />
            Auditoria — todos os privados
          </header>
          <div className="grid gap-3">
            {auditoria.map((r) => (
              <RecadoCard
                key={r.id}
                recado={r}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                destinatariosLabel={destinatariosLabel(r)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
