"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarRecadoAction, editarRecadoAction } from "@/lib/recados/actions";

type Person = { id: string; nome: string };

type Props =
  | {
      mode?: "create";
      currentUserRole: string;
      open?: undefined;
      onOpenChange?: undefined;
      recado?: undefined;
      people: Person[];
    }
  | {
      mode: "edit";
      currentUserRole: string;
      open: boolean;
      onOpenChange: (open: boolean) => void;
      recado: { id: string; titulo: string; corpo: string };
      people?: undefined;
    };

export function NovoRecadoDialog(props: Props) {
  const isEdit = props.mode === "edit";
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isEdit ? props.open : internalOpen;
  const setOpen = isEdit ? props.onOpenChange : setInternalOpen;

  const [titulo, setTitulo] = useState(isEdit ? props.recado.titulo : "");
  const [corpo, setCorpo] = useState(isEdit ? props.recado.corpo : "");
  const [notifScope, setNotifScope] = useState<"todos" | "meu_time" | "nenhum">("todos");
  const [permanente, setPermanente] = useState(false);
  const [privado, setPrivado] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const people = !isEdit ? props.people : [];
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function togglePerson(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function reset() {
    setTitulo("");
    setCorpo("");
    setNotifScope("todos");
    setPermanente(false);
    setPrivado(false);
    setSelectedIds([]);
    setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();

    startTransition(async () => {
      let result: { error?: string; success?: boolean };
      if (isEdit) {
        fd.set("id", props.recado.id);
        fd.set("titulo", titulo);
        fd.set("corpo", corpo);
        result = await editarRecadoAction(fd);
      } else {
        fd.set("titulo", titulo);
        fd.set("corpo", corpo);
        fd.set("notif_scope", privado ? "nenhum" : notifScope);
        fd.set("privado", privado ? "true" : "false");
        if (privado) fd.set("destinatarios", JSON.stringify(selectedIds));
        if (!privado && permanente) fd.set("permanente", "on");
        result = await criarRecadoAction(fd);
      }

      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (!isEdit) reset();
    });
  }

  const trigger = !isEdit ? (
    <DialogTrigger
      render={
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo recado
        </Button>
      }
    />
  ) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar recado" : "Novo recado"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="recado-titulo">Título</Label>
            <Input
              id="recado-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
              required
            />
            <p className="text-[11px] text-muted-foreground">{titulo.length}/120</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recado-corpo">Mensagem</Label>
            <Textarea
              id="recado-corpo"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              maxLength={2000}
              rows={6}
              required
            />
            <p className="text-[11px] text-muted-foreground">{corpo.length}/2000</p>
          </div>

          {!isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="recado-privado"
                checked={privado}
                onCheckedChange={(v) => setPrivado(!!v)}
              />
              <Label htmlFor="recado-privado" className="text-sm font-normal">
                Recado privado (só pra quem você escolher)
              </Label>
            </div>
          )}

          {!isEdit && privado && (
            <div className="space-y-2">
              <Label>Destinatários</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {people.length === 0 && (
                  <p className="text-xs text-muted-foreground">Ninguém disponível.</p>
                )}
                {people.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedIds.includes(p.id)}
                      onCheckedChange={() => togglePerson(p.id)}
                    />
                    {p.nome}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {selectedIds.length} selecionado(s)
              </p>
            </div>
          )}

          {!isEdit && !privado && (
            <div className="space-y-2">
              <Label htmlFor="recado-notif">Notificação</Label>
              <Select
                value={notifScope}
                onValueChange={(v) => setNotifScope(v as typeof notifScope)}
              >
                <SelectTrigger id="recado-notif" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="min-w-[var(--anchor-width)]">
                  <SelectItem value="todos">Notificar todo mundo</SelectItem>
                  <SelectItem value="meu_time">Notificar só meu time</SelectItem>
                  <SelectItem value="nenhum">Não notificar (só fica no mural)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!isEdit && !privado && props.currentUserRole === "socio" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="recado-permanente"
                checked={permanente}
                onCheckedChange={(v) => setPermanente(!!v)}
              />
              <Label htmlFor="recado-permanente" className="text-sm font-normal">
                Fixar permanentemente (não arquiva após 30 dias)
              </Label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : isEdit ? "Salvar" : "Postar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
