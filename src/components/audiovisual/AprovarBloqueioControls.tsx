"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { aprovarBloqueioAction, rejeitarBloqueioAction } from "@/lib/audiovisual/bloqueios/actions";

export function AprovarBloqueioControls({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");

  function aprovar() {
    start(async () => {
      const r = await aprovarBloqueioAction(id);
      if (r?.error) toast.error(r.error); else { toast.success("Aprovado"); router.refresh(); }
    });
  }
  function recusar() {
    if (!motivo.trim()) { toast.error("Informe o motivo da recusa"); return; }
    start(async () => {
      const fd = new FormData(); fd.set("id", id); fd.set("motivo_recusa", motivo.trim());
      const r = await rejeitarBloqueioAction(fd);
      if (r?.error) toast.error(r.error); else { toast.success("Recusado"); router.refresh(); }
    });
  }

  if (recusando) {
    return (
      <div className="space-y-2">
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da recusa" />
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" disabled={pending} onClick={recusar}>Confirmar recusa</Button>
          <Button size="sm" variant="ghost" onClick={() => setRecusando(false)}>Voltar</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={aprovar}>Aprovar</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setRecusando(true)}>Recusar</Button>
    </div>
  );
}
