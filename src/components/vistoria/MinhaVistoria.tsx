"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrScanner } from "./QrScanner";
import { registrarLeituraAction, concluirVistoriaAction } from "@/lib/vistoria/actions";
import { CATEGORIA_LABEL, progressoVistoria, type CategoriaEquipamento } from "@/lib/vistoria/core";
import type { EquipamentoRow } from "@/lib/vistoria/queries";

interface Props {
  semanaLabel: string;
  equipamentos: EquipamentoRow[];
  lidosIds: string[];
  concluida: boolean;
}

/** Mesmo QR lido de novo em até 3s é o scanner repetindo a leitura: ignora. */
const JANELA_DUPLICATA_MS = 3000;

export function MinhaVistoria({ semanaLabel, equipamentos, lidosIds, concluida }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Leituras feitas nesta tela. Junto com lidosIds (do servidor) forma o conjunto atual;
  // depois de router.refresh() o servidor já traz tudo, então não há o que sincronizar.
  const [lidosLocais, setLidosLocais] = useState<string[]>([]);
  const lidos = useMemo(() => new Set([...lidosIds, ...lidosLocais]), [lidosIds, lidosLocais]);
  const [scannerAberto, setScannerAberto] = useState(false);
  const ultimaLeitura = useRef<{ codigo: string; em: number } | null>(null);

  const progresso = useMemo(
    () => progressoVistoria(equipamentos.length, equipamentos.filter((e) => lidos.has(e.id)).length),
    [equipamentos, lidos],
  );
  const podeLer = !concluida && equipamentos.length > 0;

  function lerCodigo(texto: string) {
    const agora = Date.now();
    const chave = texto.trim().toUpperCase();
    const anterior = ultimaLeitura.current;
    if (anterior && anterior.codigo === chave && agora - anterior.em < JANELA_DUPLICATA_MS) return;
    ultimaLeitura.current = { codigo: chave, em: agora };

    start(async () => {
      const r = await registrarLeituraAction(texto);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      if (r.equipamentoId) {
        const id = r.equipamentoId;
        setLidosLocais((prev) => (prev.includes(id) ? prev : [...prev, id]));
      }
      if (r.jaLido) toast.message(`${r.nome} já estava conferido`);
      else toast.success(`✓ ${r.nome}`);
    });
  }

  function concluir() {
    if (progresso.faltando > 0) {
      const ok = window.confirm(
        `Faltam ${progresso.faltando} equipamento(s) pra bater. Concluir mesmo assim? Eles ficam marcados como faltando.`,
      );
      if (!ok) return;
    }
    start(async () => {
      const r = await concluirVistoriaAction();
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Conferência da semana concluída");
      setScannerAberto(false);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Minha conferência</h2>
          <p className="text-sm text-muted-foreground">Semana de {semanaLabel}. Escaneie o QR de cada equipamento que está com você.</p>
        </div>
        {concluida ? (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Concluída
          </span>
        ) : (
          equipamentos.length > 0 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {progresso.conferidos} de {progresso.total}
            </span>
          )
        )}
      </header>

      {equipamentos.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Nenhum equipamento está com você. Se deveria estar, peça pro gestor da Vistoria atribuir.
        </p>
      ) : (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progresso.total ? (progresso.conferidos / progresso.total) * 100 : 0}%` }}
            />
          </div>

          <ul className="divide-y rounded-xl border">
            {equipamentos.map((e) => {
              const feito = lidos.has(e.id);
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  {feito ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  {e.foto_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={e.foto_url} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORIA_LABEL[e.categoria as CategoriaEquipamento] ?? e.categoria} · {e.codigo}
                    </p>
                  </div>
                  {!feito && !concluida && <span className="text-xs text-muted-foreground">pendente</span>}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-2">
            {podeLer && (
              <Button onClick={() => setScannerAberto(true)} disabled={pending}>
                <ScanLine className="mr-2 h-4 w-4" /> Escanear QR
              </Button>
            )}
            {!concluida && (
              <Button variant="outline" onClick={concluir} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Concluir conferência
              </Button>
            )}
          </div>
        </>
      )}

      <Dialog open={scannerAberto} onOpenChange={setScannerAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escanear equipamento</DialogTitle>
            <DialogDescription>Aponte a câmera pro QR colado no equipamento. Cada leitura conta na hora.</DialogDescription>
          </DialogHeader>
          {scannerAberto && <QrScanner onCode={lerCodigo} />}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setScannerAberto(false)}>
              <X className="mr-2 h-4 w-4" /> Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
