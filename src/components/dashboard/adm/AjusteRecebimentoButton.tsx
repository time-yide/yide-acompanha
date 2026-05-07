"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { setAjusteMensalAction, removeAjusteMensalAction } from "@/lib/clientes/actions";

interface Props {
  clientId: string;
  mesReferencia: string;
  valorMensal: number;
  ajusteAtual: {
    tipo: "desconto_parcial" | "gratuidade_total";
    valor_desconto: number | null;
    motivo: string | null;
  } | null;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

const MES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function fmtMes(mesRef: string): string {
  const [y, m] = mesRef.split("-").map(Number);
  return `${MES_LABEL[m - 1]}/${y}`;
}

export function AjusteRecebimentoButton({ clientId, mesReferencia, valorMensal, ajusteAtual }: Props) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"desconto_parcial" | "gratuidade_total">(ajusteAtual?.tipo ?? "desconto_parcial");
  const [valorDesconto, setValorDesconto] = useState(String(ajusteAtual?.valor_desconto ?? ""));
  const [motivo, setMotivo] = useState(ajusteAtual?.motivo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removing, startRemove] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (tipo === "desconto_parcial") {
      const v = Number(valorDesconto);
      if (!Number.isFinite(v) || v <= 0) {
        setError("Informe o valor do desconto");
        return;
      }
      if (v >= valorMensal) {
        setError("Desconto >= valor mensal. Use gratuidade total se for o caso.");
        return;
      }
    }
    if (motivo.trim().length < 3) {
      setError("Informe o motivo (mín. 3 caracteres)");
      return;
    }

    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("mes_referencia", mesReferencia);
    fd.set("tipo", tipo);
    if (tipo === "desconto_parcial") fd.set("valor_desconto", valorDesconto);
    fd.set("motivo", motivo.trim());

    startTransition(async () => {
      const r = await setAjusteMensalAction(fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Ajuste salvo. Comissão recalcula automaticamente.");
      setOpen(false);
    });
  }

  function handleRemove() {
    startRemove(async () => {
      const r = await removeAjusteMensalAction(clientId, mesReferencia);
      if (r && "error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Ajuste removido");
      setOpen(false);
    });
  }

  const valorEfetivoPreview =
    tipo === "gratuidade_total"
      ? 0
      : Math.max(0, valorMensal - (Number(valorDesconto) || 0));

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground"
        title="Ajustar valor recebido neste mês"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar valor recebido — {fmtMes(mesReferencia)}</DialogTitle>
            <DialogDescription>
              Use quando o cliente paga menos (desconto) ou não paga (bônus de retenção).
              A comissão de assessor/coord recalcula automaticamente sobre o valor efetivo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de ajuste</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipo("desconto_parcial")}
                  className={`rounded-lg border p-3 text-left text-sm ${
                    tipo === "desconto_parcial"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <p className="font-medium">Desconto parcial</p>
                  <p className="text-xs">Cliente paga menos esse mês</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("gratuidade_total")}
                  className={`rounded-lg border p-3 text-left text-sm ${
                    tipo === "gratuidade_total"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <p className="font-medium">Bônus / gratuidade</p>
                  <p className="text-xs">Cliente não paga esse mês</p>
                </button>
              </div>
            </div>

            {tipo === "desconto_parcial" && (
              <div className="space-y-2">
                <Label htmlFor="valor_desconto">
                  Valor do desconto (R$) — sobre {formatBRL(valorMensal)} mensal
                </Label>
                <Input
                  id="valor_desconto"
                  type="number"
                  step="0.01"
                  min="0"
                  max={valorMensal}
                  value={valorDesconto}
                  onChange={(e) => setValorDesconto(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Cliente vai pagar {formatBRL(valorEfetivoPreview)} esse mês (em vez de {formatBRL(valorMensal)}).
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo</Label>
              <Textarea
                id="motivo"
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: Bônus de retenção após reclamação · Desconto promocional"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter className="flex-wrap gap-2">
              {ajusteAtual && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRemove}
                  disabled={removing || pending}
                  className="text-destructive hover:text-destructive mr-auto"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {removing ? "Removendo..." : "Remover ajuste"}
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar ajuste"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
