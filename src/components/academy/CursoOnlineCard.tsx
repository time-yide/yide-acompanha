"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Copy,
  MoreVertical,
  ExternalLink,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { deleteCursoExternoAction } from "@/lib/cursos-externos/actions";
import type { CursoExternoRow } from "@/lib/cursos-externos/schema";
import { CursoOnlineFormDialog } from "./CursoOnlineFormDialog";

interface Props {
  curso: CursoExternoRow;
  canManage: boolean;
}

export function CursoOnlineCard({ curso, canManage }: Props) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não consegui copiar — copia manualmente");
    }
  }

  function handleDelete() {
    if (!confirm(`Excluir "${curso.nome}"?`)) return;
    startDelete(async () => {
      const r = await deleteCursoExternoAction(curso.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Curso excluído");
      router.refresh();
    });
  }

  return (
    <>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-sm font-semibold leading-snug line-clamp-2">
              {curso.nome}
            </h3>
            <span className="inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {curso.plataforma}
            </span>
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Mais ações"
                disabled={deletePending}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setEditOpen(true)}
                  className="cursor-pointer"
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="cursor-pointer text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {curso.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-3">
            {curso.descricao}
          </p>
        )}

        {(curso.email_acesso || curso.senha_acesso) && (
          <div className="space-y-1.5 rounded-md border bg-muted/20 p-2 text-xs">
            {curso.email_acesso && (
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Email
                </span>
                <span className="min-w-0 flex-1 truncate font-mono">
                  {curso.email_acesso}
                </span>
                <button
                  type="button"
                  onClick={() => copy(curso.email_acesso!, "Email")}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Copiar email"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
            {curso.senha_acesso && (
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Senha
                </span>
                <span className="min-w-0 flex-1 truncate font-mono">
                  {showPassword ? curso.senha_acesso : "••••••••"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => copy(curso.senha_acesso!, "Senha")}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Copiar senha"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {curso.link && (
          <a
            href={curso.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir curso
          </a>
        )}
      </Card>

      {canManage && (
        <CursoOnlineFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          curso={curso}
        />
      )}
    </>
  );
}
