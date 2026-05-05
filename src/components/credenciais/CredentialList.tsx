"use client";

import { useState } from "react";
import { Plus, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CredentialItem } from "./CredentialItem";
import { CredentialForm } from "./CredentialForm";
import type { CredentialRow } from "@/lib/credenciais/queries";

interface Props {
  clientId: string;
  credentials: CredentialRow[];
}

export function CredentialList({ clientId, credentials }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialRow | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(credential: CredentialRow) {
    setEditing(credential);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="h-4 w-4" />
            Credenciais
            <span className="text-sm font-normal text-muted-foreground">
              ({credentials.length})
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Senhas de serviços externos do cliente. Cada vez que alguém revela uma senha, fica registrado em log de auditoria.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova credencial
        </Button>
      </div>

      {credentials.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma credencial cadastrada. Clica em <strong>Nova credencial</strong> pra adicionar a primeira.
        </p>
      ) : (
        <div className="space-y-2">
          {credentials.map((c) => (
            <CredentialItem key={c.id} credential={c} onEdit={openEdit} />
          ))}
        </div>
      )}

      <CredentialForm
        clientId={clientId}
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />
    </div>
  );
}
