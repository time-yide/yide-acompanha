"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarPesquisaAction } from "@/lib/gerador-leads/actions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NovaPesquisaModal({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [nicho, setNicho] = useState("");
  const [cidade, setCidade] = useState("");
  const [limite, setLimite] = useState("20");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("nicho", nicho.trim());
    fd.set("cidade", cidade.trim());
    fd.set("limite", limite);

    startTransition(async () => {
      const r = await criarPesquisaAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onOpenChange(false);
      // Refresh pra mostrar a pesquisa nova rodando
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" /> Nova pesquisa de leads
            </DialogTitle>
            <DialogDescription>
              Vai buscar empresas no Google Maps via Outscraper. Pesquisas com até
              50 resultados retornam em ~30s; maiores podem levar até 5min em
              background.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="nicho">Nicho / segmento *</Label>
            <Input
              id="nicho"
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              placeholder="energia solar"
              required
              minLength={2}
              maxLength={120}
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">
              Pode ser qualquer termo: &quot;dentistas&quot;, &quot;academia&quot;, &quot;loja de roupas femininas&quot;, etc.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cidade">Cidade *</Label>
            <Input
              id="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Cuiabá"
              required
              minLength={2}
              maxLength={120}
            />
            <p className="text-[10px] text-muted-foreground">
              Pode incluir bairro: &quot;Pinheiros, São Paulo&quot;.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="limite">Quantos resultados</Label>
            <Input
              id="limite"
              type="number"
              min={1}
              max={500}
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Custo Outscraper: ~$0.001-0.002 por resultado. 20 leads = ~$0.04.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <div className="rounded-md border bg-muted/20 p-3 text-[11px] text-muted-foreground">
            <p>
              <strong className="text-foreground">Dica:</strong> a pesquisa roda em
              background. Pode fechar essa janela — quando voltar, os leads vão
              aparecer na lista.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !nicho.trim() || !cidade.trim()}>
              <Search className="h-4 w-4" />
              {pending ? "Iniciando..." : "Iniciar pesquisa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
