"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arquivarAnuncioAction, updateAnuncioAction } from "@/lib/ecommerce/actions";
import { formatarDataBR } from "@/lib/ecommerce/format";
import { marketplaceLabel, marketplaceStyle } from "@/lib/ecommerce/marketplaces";
import type { AnuncioRow } from "@/lib/ecommerce/queries";
import { AnuncioFormModal } from "./AnuncioFormModal";

interface Props {
  anuncios: AnuncioRow[];
  clientes: { id: string; nome: string }[];
  mostrarAssessor: boolean;
  podeArquivar: boolean;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase();
}

export function AnunciosList({ anuncios, clientes, mostrarAssessor, podeArquivar }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState<AnuncioRow | null>(null);

  function arquivar(id: string) {
    if (!confirm("Arquivar este lançamento?")) return;
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const r = await arquivarAnuncioAction(fd);
      if ("error" in r) { alert(r.error); return; }
      router.refresh();
    });
  }

  if (anuncios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
        <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Nenhum lançamento no período</p>
        <p className="text-xs text-muted-foreground">Ajuste o filtro ou registre um novo lançamento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {anuncios.map((a) => {
        const s = marketplaceStyle(a.marketplace);
        return (
          <div
            key={a.id}
            className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 transition-all hover:border-primary/40 hover:bg-muted/20"
          >
            <span className={`absolute inset-y-0 left-0 w-1.5 ${s.bar}`} aria-hidden />

            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/40">
                <span className="text-base font-bold leading-none tabular-nums">{a.quantidade}</span>
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  {a.quantidade === 1 ? "anúncio" : "anúncios"}
                </span>
              </div>

              <div className="min-w-0">
                <p className="truncate font-semibold">{a.client_nome ?? "—"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.pill}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.bar}`} />
                    {marketplaceLabel(a.marketplace)}
                  </span>
                  <span className="tabular-nums">{formatarDataBR(a.data)}</span>
                  {mostrarAssessor && a.colaborador_nome ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                        {iniciais(a.colaborador_nome)}
                      </span>
                      <span className="truncate">{a.colaborador_nome}</span>
                    </span>
                  ) : null}
                </div>
                {a.observacao ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground/80">{a.observacao}</p>
                ) : null}
              </div>
            </div>

            {podeArquivar && (
              <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditando(a)}
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => arquivar(a.id)}
                  aria-label="Arquivar"
                  className="hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {editando && (
        <AnuncioFormModal
          key={editando.id}
          clientes={clientes}
          titulo="Editar lançamento"
          initial={{
            id: editando.id,
            client_id: editando.client_id,
            data: editando.data,
            quantidade: editando.quantidade,
            marketplace: editando.marketplace,
            observacao: editando.observacao,
          }}
          action={updateAnuncioAction}
          onClose={() => setEditando(null)}
          onDone={() => { setEditando(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
