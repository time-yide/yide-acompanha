"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { solicitarBloqueioAction } from "@/lib/audiovisual/bloqueios/actions";

export function SolicitarBloqueioModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState("");
  const [hi, setHi] = useState("");
  const [hf, setHf] = useState("");
  const [motivo, setMotivo] = useState("");

  const valido = !!data && !!hi && !!hf && hf > hi && motivo.trim().length > 0;

  function submit() {
    if (!valido) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("data", data); fd.set("hora_inicio", hi); fd.set("hora_fim", hf); fd.set("motivo", motivo.trim());
      const r = await solicitarBloqueioAction(fd);
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Solicitação enviada pro coordenador");
      setData(""); setHi(""); setHf(""); setMotivo(""); setOpen(false); router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Solicitar bloqueio de agenda</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar bloqueio de agenda</DialogTitle>
            <DialogDescription>Vai pro coordenador audiovisual aprovar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Dia</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div className="flex gap-2">
              <div className="flex-1"><Label>Início</Label><Input type="time" value={hi} onChange={(e) => setHi(e.target.value)} /></div>
              <div className="flex-1"><Label>Fim</Label><Input type="time" value={hf} onChange={(e) => setHf(e.target.value)} /></div>
            </div>
            <div><Label>Motivo</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: consulta médica" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!valido || pending} onClick={submit}>{pending ? "Enviando..." : "Enviar solicitação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
