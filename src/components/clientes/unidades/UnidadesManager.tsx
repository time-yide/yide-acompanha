"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ExternalLink,
  MoreVertical,
  Pencil,
  Trash2,
  PowerOff,
  Power,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteUnidadeAction,
  toggleUnidadeAtivoAction,
} from "@/lib/clientes/unidades/actions";
import type { ClientUnitRow } from "@/lib/clientes/unidades/schema";
import { UnidadeFormDialog } from "./UnidadeFormDialog";

interface Props {
  clientId: string;
  unidades: ClientUnitRow[];
  canManage: boolean;
}

export function UnidadesManager({ clientId, unidades, canManage }: Props) {
  const router = useRouter();
  const [novaOpen, setNovaOpen] = useState(false);
  const [editando, setEditando] = useState<ClientUnitRow | null>(null);
  const [pending, startTransition] = useTransition();

  function handleToggleAtivo(unidade: ClientUnitRow) {
    startTransition(async () => {
      const r = await toggleUnidadeAtivoAction(unidade.id, !unidade.ativo);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(unidade.ativo ? "Unidade arquivada" : "Unidade reativada");
      router.refresh();
    });
  }

  function handleDelete(unidade: ClientUnitRow) {
    if (!confirm(`Excluir definitivamente "${unidade.nome}"?`)) return;
    startTransition(async () => {
      const r = await deleteUnidadeAction(unidade.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Unidade excluída");
      router.refresh();
    });
  }

  const ativas = unidades.filter((u) => u.ativo);
  const inativas = unidades.filter((u) => !u.ativo);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Unidades</h1>
          <p className="text-sm text-muted-foreground">
            {ativas.length} ativa{ativas.length === 1 ? "" : "s"}
            {inativas.length > 0 && ` · ${inativas.length} arquivada${inativas.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setNovaOpen(true)} disabled={pending}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova unidade
          </Button>
        )}
      </header>

      {unidades.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium">Nenhuma unidade cadastrada</p>
            <p className="text-sm text-muted-foreground">
              {canManage
                ? "Cadastre filiais/lojas/unidades pra organizar conteúdo por localização."
                : "Quando o adm cadastrar as unidades, aparecem aqui."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {ativas.length > 0 && (
            <UnidadesList
              titulo="Ativas"
              unidades={ativas}
              canManage={canManage}
              pending={pending}
              onEdit={setEditando}
              onToggle={handleToggleAtivo}
              onDelete={handleDelete}
            />
          )}
          {inativas.length > 0 && (
            <UnidadesList
              titulo="Arquivadas"
              unidades={inativas}
              canManage={canManage}
              pending={pending}
              onEdit={setEditando}
              onToggle={handleToggleAtivo}
              onDelete={handleDelete}
              muted
            />
          )}
        </div>
      )}

      {canManage && (
        <>
          <UnidadeFormDialog
            open={novaOpen}
            onOpenChange={setNovaOpen}
            clientId={clientId}
          />
          {editando && (
            <UnidadeFormDialog
              open={!!editando}
              onOpenChange={(o) => !o && setEditando(null)}
              clientId={clientId}
              unidade={editando}
            />
          )}
        </>
      )}
    </div>
  );
}

interface ListProps {
  titulo: string;
  unidades: ClientUnitRow[];
  canManage: boolean;
  pending: boolean;
  onEdit: (u: ClientUnitRow) => void;
  onToggle: (u: ClientUnitRow) => void;
  onDelete: (u: ClientUnitRow) => void;
  muted?: boolean;
}

function UnidadesList({
  titulo,
  unidades,
  canManage,
  pending,
  onEdit,
  onToggle,
  onDelete,
  muted,
}: ListProps) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo} ({unidades.length})
      </h2>
      <ul className="space-y-2">
        {unidades.map((u) => (
          <li key={u.id}>
            <Card className={`flex items-start gap-3 p-3 ${muted ? "opacity-60" : ""}`}>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-4 w-4" />
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
                    Pasta no Drive
                  </a>
                )}
                {u.observacoes && (
                  <p className="line-clamp-2 text-[11px] italic text-muted-foreground">
                    {u.observacoes}
                  </p>
                )}
              </div>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    disabled={pending}
                    aria-label="Mais ações"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(u)} className="cursor-pointer">
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggle(u)} className="cursor-pointer">
                      {u.ativo ? (
                        <>
                          <PowerOff className="mr-2 h-3.5 w-3.5" />
                          Arquivar
                        </>
                      ) : (
                        <>
                          <Power className="mr-2 h-3.5 w-3.5" />
                          Reativar
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(u)}
                      className="cursor-pointer text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Excluir definitivamente
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
