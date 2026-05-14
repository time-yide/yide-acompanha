"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { uploadMaterialAction } from "@/lib/manual/actions";

export function UploadMaterialDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }
    if (!nome.trim()) {
      toast.error("Informe um nome pro material");
      return;
    }

    const fd = new FormData();
    fd.set("nome", nome.trim());
    fd.set("descricao", descricao.trim());
    fd.set("file", file);

    startTransition(async () => {
      const r = await uploadMaterialAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Material enviado");
      setNome("");
      setDescricao("");
      if (fileRef.current) fileRef.current.value = "";
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Novo material
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir material</DialogTitle>
          <DialogDescription>
            PDF, slide, planilha, doc: qualquer arquivo até 25MB. Visível pra
            toda a equipe.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Modelo de briefing 2026"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Pra que serve, quando usar, etc. (opcional)"
              rows={3}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file">Arquivo *</Label>
            <Input
              id="file"
              type="file"
              required
              ref={fileRef}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
