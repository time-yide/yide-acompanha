"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { salvarCardAction } from "@/lib/perfil-jogador/actions";
import type { PerfilJogador } from "@/lib/perfil-jogador/schema";

export function EditarCardForm({ userId, perfil }: { userId: string; perfil: PerfilJogador | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await salvarCardAction(userId, fd);
      if (r?.error) { setErro(r.error); toast.error(r.error); return; }
      toast.success("Card salvo");
      router.push(`/perfil/${userId}`);
      router.refresh();
    });
  }

  const label = "block text-sm font-medium";
  const input = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={label} htmlFor="username">Username</label>
        <input id="username" name="username" defaultValue={perfil?.username ?? ""} placeholder="ex.: yasmin_m" className={input} />
        <p className="mt-1 text-[11px] text-muted-foreground">3–20 caracteres: letras, números, ponto e underline.</p>
      </div>
      <div>
        <label className={label} htmlFor="frase">Frase / lema</label>
        <input id="frase" name="frase" defaultValue={perfil?.frase ?? ""} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="bio">Sobre mim</label>
        <textarea id="bio" name="bio" defaultValue={perfil?.bio ?? ""} rows={3} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="como_trabalho">Como gosto de trabalhar</label>
        <textarea id="como_trabalho" name="como_trabalho" defaultValue={perfil?.como_trabalho ?? ""} rows={3} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="hobbies">Hobbies & interesses</label>
        <input id="hobbies" name="hobbies" defaultValue={(perfil?.hobbies ?? []).join(", ")} placeholder="música, jogos, corrida" className={input} />
        <p className="mt-1 text-[11px] text-muted-foreground">Separe por vírgula.</p>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>Cancelar</Button>
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
      </div>
    </form>
  );
}
