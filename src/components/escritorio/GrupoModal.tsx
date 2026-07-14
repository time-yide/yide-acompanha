"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Camera, Users, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createGroupAction, updateGroupAction } from "@/lib/escritorio/channel-actions";
import { uploadChannelIconAction, removeChannelIconAction } from "@/lib/escritorio/icon-actions";

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
  initialIconUrl?: string | null;
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
  initialIconUrl = null,
}: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(initialNome);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialMemberIds));
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();

  // Foto do grupo: arquivo escolhido (upload após salvar) + flag de remoção.
  const fileRef = useRef<HTMLInputElement>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconRemoved, setIconRemoved] = useState(false);
  const iconSrc = iconPreview ?? (iconRemoved ? null : initialIconUrl);

  function pickIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      toast.error("Use JPEG, PNG ou WebP");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Máximo 2MB");
      return;
    }
    setIconFile(f);
    setIconRemoved(false);
    setIconPreview(URL.createObjectURL(f));
  }

  function clearIcon() {
    setIconFile(null);
    setIconPreview(null);
    setIconRemoved(true);
  }

  /** Aplica a foto (upload ou remoção) depois que o grupo já existe. */
  async function applyIcon(cid: string) {
    if (iconFile) {
      const ifd = new FormData();
      ifd.set("icon", iconFile);
      const ir = await uploadChannelIconAction(cid, ifd);
      if ("error" in ir) toast.error(`Grupo salvo, mas a foto falhou: ${ir.error}`);
    } else if (iconRemoved && initialIconUrl) {
      await removeChannelIconAction(cid);
    }
  }

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
        if (r.channelId) await applyIcon(r.channelId);
        onOpenChange(false);
        setNome("");
        setSelected(new Set());
        setSearch("");
        setIconFile(null);
        setIconPreview(null);
        if (r.channelId) router.push(`/escritorio/grupo/${r.channelId}`);
      } else {
        if (!channelId) return;
        const r = await updateGroupAction(channelId, nome, memberIds);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        await applyIcon(channelId);
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
          {/* Foto do grupo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border bg-muted"
              title="Trocar foto do grupo"
            >
              {iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconSrc} alt="Foto do grupo" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Users className="h-6 w-6" />
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-5 w-5 text-white" />
              </span>
            </button>
            <div className="space-y-1">
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Camera className="mr-1.5 h-3.5 w-3.5" /> Trocar foto
              </Button>
              {iconSrc && (
                <button
                  type="button"
                  onClick={clearIcon}
                  className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" /> Remover
                </button>
              )}
              <p className="text-[11px] text-muted-foreground">JPEG, PNG ou WebP · máx. 2MB</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={pickIcon}
              className="hidden"
            />
          </div>

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
