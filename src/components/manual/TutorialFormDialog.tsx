"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
import {
  createTutorialAction,
  updateTutorialAction,
} from "@/lib/manual/tutoriais-actions";
import {
  SETOR_LABEL,
  SETOR_ORDER,
  type TutorialSetor,
} from "@/lib/manual/tutoriais";

interface Props {
  /** Se passado, dialog vira modo edição. */
  edit?: {
    id: string;
    titulo: string;
    descricao: string | null;
    setor: TutorialSetor | null;
    video_url: string;
    ordem: number;
  };
}

export function TutorialFormDialog({ edit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState(edit?.titulo ?? "");
  const [descricao, setDescricao] = useState(edit?.descricao ?? "");
  const [setor, setSetor] = useState<string>(edit?.setor ?? "");
  const [videoUrl, setVideoUrl] = useState(edit?.video_url ?? "");
  const [ordem, setOrdem] = useState(String(edit?.ordem ?? 0));

  function reset() {
    if (edit) return;
    setTitulo("");
    setDescricao("");
    setSetor("");
    setVideoUrl("");
    setOrdem("0");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!titulo.trim() || !videoUrl.trim()) {
      toast.error("Título e URL são obrigatórios");
      return;
    }
    const fd = new FormData();
    if (edit) fd.set("id", edit.id);
    fd.set("titulo", titulo.trim());
    fd.set("descricao", descricao.trim());
    fd.set("setor", setor); // "" vira null no action (tutorial geral)
    fd.set("video_url", videoUrl.trim());
    fd.set("ordem", ordem || "0");

    startTransition(async () => {
      const r = edit
        ? await updateTutorialAction(fd)
        : await createTutorialAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(edit ? "Tutorial atualizado" : "Tutorial cadastrado");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {edit ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setOpen(true)}
        >
          <Pencil className="h-3 w-3" />
          Editar
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo tutorial
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit ? "Editar tutorial" : "Cadastrar tutorial"}</DialogTitle>
            <DialogDescription>
              Cole o link do YouTube, Vimeo ou Loom. O vídeo é embedado direto na página.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Como subir link de drive da gravação"
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setor">Setor</Label>
              <select
                id="setor"
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                disabled={pending}
                className="block h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="">Geral (todo mundo vê)</option>
                {SETOR_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {SETOR_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video_url">URL do vídeo *</Label>
              <Input
                id="video_url"
                required
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtu.be/... · https://vimeo.com/... · https://loom.com/share/..."
                disabled={pending}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="O que esse tutorial cobre, quando assistir, etc."
                  rows={3}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ordem">Ordem</Label>
                <Input
                  id="ordem"
                  type="number"
                  min={0}
                  max={9999}
                  value={ordem}
                  onChange={(e) => setOrdem(e.target.value)}
                  disabled={pending}
                  className="w-20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : edit ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
