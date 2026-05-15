import { MapPin, ExternalLink } from "lucide-react";
import type { ClientUnitRow } from "@/lib/clientes/unidades/schema";

interface Props {
  unidades: ClientUnitRow[];
}

/**
 * Lista das unidades ativas do cliente no portal. Quando não tem unidade
 * cadastrada, seção não renderiza (return null) — não polui pra cliente
 * single-unidade.
 */
export function UnidadesSection({ unidades }: Props) {
  if (unidades.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Suas unidades</h2>
              <p className="text-xs text-muted-foreground">
                {unidades.length} {unidades.length === 1 ? "unidade ativa" : "unidades ativas"}
              </p>
            </div>
          </div>
        </header>

        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {unidades.map((u) => (
            <li key={u.id}>
              <div className="flex items-start gap-3 rounded-xl border bg-background/40 p-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-semibold">{u.nome}</p>
                  {u.endereco && (
                    <p className="truncate text-xs text-muted-foreground">{u.endereco}</p>
                  )}
                  {u.drive_url && (
                    <a
                      href={u.drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Pasta da unidade
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
