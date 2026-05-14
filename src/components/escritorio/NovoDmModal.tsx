"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { openOrCreateDmAction } from "@/lib/escritorio/dm-actions";

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
}

/**
 * Modal "Nova conversa": lista pessoas ativas com search. Click cria
 * (ou abre, se já existe) DM com a pessoa e navega pra ela.
 */
export function NovoDmModal({ open, onOpenChange, pessoas }: Props) {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pessoas;
    return pessoas.filter((p) => p.nome.toLowerCase().includes(q));
  }, [pessoas, search]);

  async function handlePick(targetId: string) {
    setPending(targetId);
    try {
      const r = await openOrCreateDmAction(targetId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      onOpenChange(false);
      setSearch("");
      router.push(`/escritorio/dm/${r.channelId}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Buscar pessoa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="max-h-[60vh] overflow-y-auto -mx-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ninguém encontrado.
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePick(p.id)}
                disabled={pending === p.id}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
              >
                <Avatar className="h-9 w-9">
                  {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.nome} /> : null}
                  <AvatarFallback className="text-xs">{initials(p.nome)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.nome}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {p.role.replaceAll("_", " ")}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
