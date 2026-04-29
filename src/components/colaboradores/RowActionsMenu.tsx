"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArquivarDialog } from "@/components/colaboradores/ArquivarDialog";

export function RowActionsMenu({
  userId,
  userNome,
  ativo,
  canEdit,
  canArchive,
  isSelf,
}: {
  userId: string;
  userNome: string;
  ativo: boolean;
  canEdit: boolean;
  canArchive: boolean;
  isSelf: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const acao: "arquivar" | "desarquivar" = ativo ? "arquivar" : "desarquivar";

  // Mostra item de arquivar/desarquivar quando tem permissão e não é a si mesmo.
  // Se ativo: pode arquivar (e !isSelf). Se inativo: pode desarquivar (isSelf
  // é irrelevante porque um usuário arquivado não está logado).
  const showArchiveItem = canArchive && (ativo ? !isSelf : true);

  // Sem nenhuma ação disponível: não renderiza menu.
  if (!canEdit && !showArchiveItem) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${userNome}`} />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem
              render={
                <Link href={`/colaboradores/${userId}/editar`} />
              }
            >
              <Pencil />
              Editar
            </DropdownMenuItem>
          )}
          {canEdit && showArchiveItem && <DropdownMenuSeparator />}
          {showArchiveItem && (
            <DropdownMenuItem
              variant={ativo ? "destructive" : "default"}
              onClick={() => setDialogOpen(true)}
            >
              {ativo ? (
                <>
                  <Archive />
                  Arquivar
                </>
              ) : (
                <>
                  <ArchiveRestore />
                  Desarquivar
                </>
              )}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showArchiveItem && (
        <ArquivarDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={userId}
          userNome={userNome}
          acao={acao}
        />
      )}
    </>
  );
}
