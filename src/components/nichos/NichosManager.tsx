"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NichoFormDialog } from "./NichoFormDialog";
import { deleteNichoAction } from "@/lib/nichos/actions";
import type { NichoRow } from "@/lib/nichos/schema";

interface Props {
  nichos: NichoRow[];
}

export function NichosManager({ nichos }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NichoRow | null>(null);
  const [deleting, startDelete] = useTransition();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(nicho: NichoRow) {
    setEditing(nicho);
    setDialogOpen(true);
  }

  function handleDelete(nicho: NichoRow) {
    if (!confirm(`Excluir o nicho "${nicho.nome}"?`)) return;
    startDelete(async () => {
      const fd = new FormData();
      fd.set("id", nicho.id);
      const result = await deleteNichoAction(fd);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao excluir");
        return;
      }
      toast.success("Nicho excluído");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {nichos.length === 0
            ? "Nenhum nicho cadastrado."
            : `${nichos.length} nicho${nichos.length > 1 ? "s" : ""}`}
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Novo nicho
        </Button>
      </div>

      {nichos.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-center">Datas</TableHead>
                <TableHead className="text-center">Palavras-chave</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {nichos.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.nome}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {n.slug}
                  </TableCell>
                  <TableCell className="text-center">
                    {n.datas_comemorativas.length}
                  </TableCell>
                  <TableCell className="text-center">
                    {n.palavras_chave.length}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(n)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(n)}
                        disabled={deleting}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NichoFormDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        nicho={editing}
      />
    </div>
  );
}
