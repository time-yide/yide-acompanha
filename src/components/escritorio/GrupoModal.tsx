"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createGroupAction, updateGroupAction } from "@/lib/escritorio/channel-actions";

function initials(nome: string | undefined | null): string {
  if (!nome) return "";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Pessoa {
  id: string;
  nome: string;
  role: string;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoas: Pessoa[];
  /** "create" (novo grupo) ou "edit" (editar existente). */
  mode: "create" | "edit";
  /** Só no modo "edit". */
  channelId?: string;
  initialNome?: string;
  initialMemberIds?: string[];
}

/**
 * Modal de criar/editar grupo: nome + seleção de pessoas a dedo (checkbox +
 * busca). No create, navega pro grupo criado; no edit, atualiza e refresh.
 */
export function GrupoModal({
  open,
  onOpenChange,
  pessoas,
  mode,
  channelId,
  initialNome = "",
  initialMemberIds = [],
}: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(initialNome);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialMemberIds));
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pessoas;
    return pessoas.filter((p) => p.nome.toLowerCase().includes(q));
  }, [pessoas, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    const memberIds = [...selected];
    if (nome.trim().length < 2) {
      toast.error("Dê um nome ao grupo");
      return;
    }
    if (memberIds.length === 0) {
      toast.error("Escolha ao menos 1 pessoa");
      return;
    }
    start(async () => {
      if (mode === "create") {
        const r = await createGroupAction(nome, memberIds);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        onOpenChange(false);
        setNome("");
        setSelected(new Set());
        setSearch("");
        if (r.channelId) router.push(`/escritorio/grupo/${r.channelId}`);
      } else {
        if (!channelId) return;
        const r = await updateGroupAction(channelId, nome, memberIds);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        toast.success("Grupo atualizado");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo grupo" : "Editar grupo"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="grupo-nome">Nome do grupo</Label>
            <Input
              id="grupo-nome"
              placeholder="Ex: Campanha de Natal"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Membros{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({selected.size} selecionado{selected.size === 1 ? "" : "s"})
              </span>
            </Label>
            <Input
              placeholder="Buscar pessoa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-[45vh] overflow-y-auto rounded-md border">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Ninguém encontrado.</p>
              ) : (
                filtered.map((p) => {
                  const isSel = selected.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted",
                        isSel && "bg-primary/5",
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.nome} /> : null}
                        <AvatarFallback className="text-[10px]">{initials(p.nome)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.nome}</div>
                        <div className="text-xs capitalize text-muted-foreground">
                          {p.role.replaceAll("_", " ")}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border",
                          isSel ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                        )}
                      >
                        {isSel && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Salvando…" : mode === "create" ? "Criar grupo" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
