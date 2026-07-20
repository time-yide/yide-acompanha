"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { publicarCampanhaNoMetaAction } from "@/lib/trafego/actions";
import type { CampanhaRow } from "@/lib/trafego/queries";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campanha: CampanhaRow;
}

type Genero = "todos" | "masc" | "fem";

interface SucessoIds {
  campaignId: string;
  adsetId: string;
  adId: string;
}

/** Link pro Gerenciador de Anúncios da campanha criada. */
function gerenciadorUrl(campaignId: string, accountId: string): string {
  const act = accountId.replace(/^act_/, "");
  return `https://business.facebook.com/adsmanager/manage/campaigns?act=${act}&selected_campaign_ids=${campaignId}`;
}

export function PublicarMetaModal({ open, onOpenChange, campanha }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [passo, setPasso] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<SucessoIds & { accountId: string } | null>(null);

  const [budget, setBudget] = useState<string>(
    campanha.budget_diario != null ? String(campanha.budget_diario) : "",
  );
  const [pais, setPais] = useState<string>("BR");
  const [idadeMin, setIdadeMin] = useState<string>("18");
  const [idadeMax, setIdadeMax] = useState<string>("65");
  const [genero, setGenero] = useState<Genero>("todos");

  function onConfirm() {
    setError(null);
    setPasso(null);

    const budgetNum = Number(budget);
    if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
      setError("Informe um orçamento diário maior que zero");
      return;
    }

    const generos = genero === "masc" ? [1] : genero === "fem" ? [2] : [];
    const paises = pais.trim() ? [pais.trim().toUpperCase()] : ["BR"];

    startTransition(async () => {
      const r = await publicarCampanhaNoMetaAction({
        campanha_id: campanha.id,
        budget_diario: budgetNum,
        paises,
        idade_min: Number(idadeMin) || 18,
        idade_max: Number(idadeMax) || 65,
        generos,
      });
      if ("error" in r) {
        setError(r.error);
        setPasso(r.passoQueFalhou ?? null);
        return;
      }
      setSucesso({
        campaignId: r.ids.campaignId,
        adsetId: r.ids.adsetId,
        adId: r.ids.adId,
        accountId: r.ids.accountId,
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publicar no Meta (pausado)</DialogTitle>
        </DialogHeader>

        {sucesso ? (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-semibold">Criado como PAUSADO.</p>
              <p className="mt-1 text-xs">
                Nada vai ao ar até você ativar manualmente no Gerenciador de Anúncios.
              </p>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><strong className="text-foreground">Campanha:</strong> {sucesso.campaignId}</p>
              <p><strong className="text-foreground">Conjunto:</strong> {sucesso.adsetId}</p>
              <p><strong className="text-foreground">Anúncio:</strong> {sucesso.adId}</p>
            </div>
            <a
              href={gerenciadorUrl(sucesso.campaignId, sucesso.accountId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-medium text-primary underline"
            >
              Abrir no Gerenciador de Anúncios
            </a>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              Será criado <strong>PAUSADO</strong> — não vai ao ar até você ativar no
              Gerenciador de Anúncios.
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pub_budget">Orçamento diário (R$) *</Label>
              <Input
                id="pub_budget"
                type="number"
                step="0.01"
                min={1}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="100.00"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pub_pais">País</Label>
                <Input
                  id="pub_pais"
                  value={pais}
                  onChange={(e) => setPais(e.target.value)}
                  maxLength={2}
                  placeholder="BR"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pub_genero">Gênero</Label>
                <Select value={genero} onValueChange={(v) => setGenero((v as Genero) ?? "todos")}>
                  <SelectTrigger id="pub_genero"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="masc">Masculino</SelectItem>
                    <SelectItem value="fem">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pub_idade_min">Idade mínima</Label>
                <Input
                  id="pub_idade_min"
                  type="number"
                  min={13}
                  max={65}
                  value={idadeMin}
                  onChange={(e) => setIdadeMin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pub_idade_max">Idade máxima</Label>
                <Input
                  id="pub_idade_max"
                  type="number"
                  min={13}
                  max={65}
                  value={idadeMax}
                  onChange={(e) => setIdadeMax(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">
                {passo && passo !== "validacao" && (
                  <span className="font-semibold">Falhou no passo &quot;{passo}&quot;: </span>
                )}
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" onClick={onConfirm} disabled={pending}>
                {pending ? "Publicando..." : "Publicar pausado"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
