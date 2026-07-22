"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { criarReviewAction } from "@/lib/review/actions";
import { UploadVersao } from "./UploadVersao";
import type { UploadTus } from "@/lib/bunny/client";

export function NovoReviewForm({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [criado, setCriado] = useState<{ reviewId: string; upload: UploadTus } | null>(null);
  const [pending, start] = useTransition();
  function criar() {
    start(async () => {
      const r = await criarReviewAction(titulo, clienteId || null);
      if ("error" in r) { toast.error(r.error); return; }
      setCriado(r);
    });
  }
  if (criado) return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Review criado. Agora envie o vídeo:</p>
      <UploadVersao reviewId={criado.reviewId} upload={criado.upload} titulo={titulo} />
      <a href={`/audiovisual/review/${criado.reviewId}`} className="text-sm text-primary hover:underline">Abrir o review →</a>
    </div>
  );
  const input = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <div className="space-y-3">
      <div><label className="block text-sm font-medium">Título</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={input} /></div>
      <div><label className="block text-sm font-medium">Cliente</label>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={input}>
          <option value="">Sem cliente</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <Button type="button" onClick={criar} disabled={pending || !titulo.trim()}>Criar e enviar vídeo</Button>
    </div>
  );
}
