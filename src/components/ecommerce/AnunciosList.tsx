"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arquivarAnuncioAction, updateAnuncioAction } from "@/lib/ecommerce/actions";
import { formatarDataBR } from "@/lib/ecommerce/format";
import { marketplaceLabel } from "@/lib/ecommerce/marketplaces";
import type { AnuncioRow } from "@/lib/ecommerce/queries";
import { AnuncioFormModal } from "./AnuncioFormModal";

interface Props {
  anuncios: AnuncioRow[];
  clientes: { id: string; nome: string }[];
  mostrarAssessor: boolean;
  podeArquivar: boolean;
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
      <p className="text-sm text-muted-foreground">
        Nenhum lançamento no período.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {anuncios.map((a) => (
        <div
          key={a.id}
          className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-card p-3"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold truncate">
              {a.client_nome ?? "—"}
              <span className="ml-2 rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
                {a.quantidade} {a.quantidade === 1 ? "anúncio" : "anúncios"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatarDataBR(a.data)} &middot; {marketplaceLabel(a.marketplace)}
              {mostrarAssessor && a.colaborador_nome ? (
                <span> &middot; {a.colaborador_nome}</span>
              ) : null}
            </p>
            {a.observacao ? (
              <p className="text-xs text-muted-foreground">{a.observacao}</p>
            ) : null}
          </div>
          {podeArquivar && (
            <div className="flex items-center gap-1">
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
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ))}

      {editando && (
        <AnuncioFormModal
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
