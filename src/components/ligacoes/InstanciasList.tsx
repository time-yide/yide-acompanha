"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Phone, MessageCircle, Plus, Pencil, Archive, AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InstanciaFormModal } from "./InstanciaFormModal";
import { archiveInstanciaAction, type InstanciaRow } from "@/lib/ligacoes/instancia-actions";
import { PROVEDOR_BY_VALUE, STATUS_INSTANCIA_DEFS } from "@/lib/ligacoes/instancias";

interface Props {
  instancias: InstanciaRow[];
  colaboradores: Array<{ id: string; nome: string }>;
  canManage: boolean;
}

export function InstanciasList({ instancias, colaboradores, canManage }: Props) {
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<InstanciaRow | null>(null);

  function novaInstancia() {
    setEditing(null);
    setOpenForm(true);
  }

  function editar(i: InstanciaRow) {
    setEditing(i);
    setOpenForm(true);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <div>
          <h2 className="text-sm font-semibold">Números / Ramais cadastrados</h2>
          <p className="text-[11px] text-muted-foreground">
            Cada instância representa um número de telefone ou WhatsApp conectado.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={novaInstancia}>
            <Plus className="h-4 w-4" /> Cadastrar número
          </Button>
        )}
      </div>

      {instancias.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Phone className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          Nenhum número cadastrado ainda.
          {canManage && " Clica em \"Cadastrar número\" pra começar."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {instancias.map((i) => (
            <InstanciaCard key={i.id} instancia={i} canManage={canManage} onEdit={() => editar(i)} />
          ))}
        </div>
      )}

      {openForm && (
        <InstanciaFormModal
          open={openForm}
          onOpenChange={setOpenForm}
          instancia={editing}
          colaboradores={colaboradores}
        />
      )}
    </>
  );
}

function InstanciaCard({
  instancia, canManage, onEdit,
}: {
  instancia: InstanciaRow;
  canManage: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pendingArchive, startArchive] = useTransition();
  const provedorDef = PROVEDOR_BY_VALUE[instancia.provedor];
  const statusDef = STATUS_INSTANCIA_DEFS[instancia.status];
  const isWA = instancia.tipo === "whatsapp";

  function arquivar() {
    if (!confirm(`Arquivar "${instancia.nome}"?`)) return;
    const fd = new FormData();
    fd.set("id", instancia.id);
    startArchive(async () => {
      await archiveInstanciaAction(fd);
      router.refresh();
    });
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {isWA ? (
            <MessageCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <Phone className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{instancia.nome}</h3>
            {instancia.numero && (
              <p className="text-[11px] text-muted-foreground tabular-nums">{instancia.numero}</p>
            )}
            {instancia.ramal && (
              <p className="text-[10px] text-muted-foreground">Ramal: {instancia.ramal}</p>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
              title="Editar"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={arquivar}
              disabled={pendingArchive}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted disabled:opacity-50"
              title="Arquivar"
            >
              {pendingArchive ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusDef?.color ?? ""}`}>
          {instancia.status === "conectado" ? (
            <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
          ) : (
            <AlertCircle className="h-2.5 w-2.5 mr-1" />
          )}
          {statusDef?.label ?? instancia.status}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {provedorDef?.label ?? instancia.provedor}
          {provedorDef?.status === "em_construcao" && (
            <span className="ml-1 rounded-full bg-amber-500/20 px-1 text-[9px] text-amber-700 dark:text-amber-300">
              em construção
            </span>
          )}
        </Badge>
      </div>

      {instancia.colaborador_nome && (
        <p className="text-[11px] text-muted-foreground">
          👤 <strong className="text-foreground">{instancia.colaborador_nome}</strong>
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t text-[10px] text-muted-foreground">
        <span>{instancia.total_ligacoes} ligaç{instancia.total_ligacoes === 1 ? "ão" : "ões"}</span>
        {instancia.ultimo_evento_em && (
          <span>Último evento: {new Date(instancia.ultimo_evento_em).toLocaleDateString("pt-BR")}</span>
        )}
      </div>
    </Card>
  );
}
