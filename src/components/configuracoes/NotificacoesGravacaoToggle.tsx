// src/components/configuracoes/NotificacoesGravacaoToggle.tsx
"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toggleAlertaGravacaoPendente } from "@/lib/configuracoes/notif-gravacao-actions";

interface Props {
  defaultAtivo: boolean;
}

export function NotificacoesGravacaoToggle({ defaultAtivo }: Props) {
  const [ativo, setAtivo] = useState(defaultAtivo);
  const [pending, start] = useTransition();

  function onChange(v: boolean) {
    setAtivo(v);
    start(async () => {
      const r = await toggleAlertaGravacaoPendente(v);
      if ("error" in r) setAtivo(!v);
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-md border bg-card p-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">
          Alerta quando videomaker não confirmou gravação
        </Label>
        <p className="text-xs text-muted-foreground">
          Você recebe uma notificação quando faltam 2h pra uma gravação e o
          videomaker ainda não confirmou que leu e imprimiu o roteiro.
          Assessores e coordenadores audiovisuais recebem sempre — isso aqui é
          opt-in pra adm/sócio.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Switch checked={ativo} onCheckedChange={onChange} disabled={pending} />
      </div>
    </div>
  );
}
