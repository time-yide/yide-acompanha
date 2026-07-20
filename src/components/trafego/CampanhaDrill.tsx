"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Layers, ImageIcon, AlertCircle } from "lucide-react";
import {
  getCampanhaAdSetsAction,
  getAdSetAdsAction,
  type AdSetDrill,
  type AdDrill,
} from "@/lib/trafego/actions";
import { MetricaResumo } from "./MetricaResumo";

/** Estado de um carregamento sob demanda com cache no próprio estado. */
type Load<T> =
  | { fase: "idle" }
  | { fase: "loading" }
  | { fase: "error"; msg: string }
  | { fase: "done"; dados: T };

/** effective_status cru do Meta → { rótulo pt-br, cor }. */
function statusBadge(effective: string): { label: string; cls: string } {
  const s = effective.toUpperCase();
  if (s === "ACTIVE")
    return { label: "Ativo", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  if (s === "PAUSED" || s === "ADSET_PAUSED" || s === "CAMPAIGN_PAUSED")
    return { label: "Pausado", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  if (s === "PENDING_REVIEW" || s === "IN_PROCESS" || s === "PENDING_BILLING_INFO")
    return { label: "Em análise", cls: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300" };
  if (s === "DISAPPROVED" || s === "WITH_ISSUES")
    return { label: "Com problema", cls: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300" };
  if (s === "ARCHIVED" || s === "DELETED" || s === "COMPLETED")
    return { label: "Finalizado", cls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300" };
  return { label: effective, cls: "border-muted-foreground/30 text-muted-foreground" };
}

function StatusPill({ effective }: { effective: string }) {
  const { label, cls } = statusBadge(effective);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ErroBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-[11px] text-rose-700 dark:text-rose-300">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

/**
 * Bloco de drill-down de UMA campanha: botão "Ver conjuntos" que busca os
 * ad sets sob demanda e, dentro de cada um, "Ver anúncios". Tudo com cache no
 * estado local (não re-busca ao abrir/fechar).
 */
export function CampanhaDrill({ campanhaId }: { campanhaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [load, setLoad] = useState<Load<AdSetDrill[]>>({ fase: "idle" });

  async function toggle() {
    const proximo = !aberto;
    setAberto(proximo);
    if (proximo && load.fase === "idle") {
      setLoad({ fase: "loading" });
      const res = await getCampanhaAdSetsAction(campanhaId);
      if ("error" in res) setLoad({ fase: "error", msg: res.error });
      else setLoad({ fase: "done", dados: res.adsets });
    }
  }

  return (
    <div className="rounded-md border bg-muted/10">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-foreground/80 hover:bg-muted/40"
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 transition-transform ${aberto ? "rotate-90" : ""}`}
        />
        <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        Ver conjuntos de anúncios
      </button>

      {aberto && (
        <div className="space-y-2 border-t px-3 py-3">
          {load.fase === "loading" && (
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando conjuntos no Meta…
            </p>
          )}
          {load.fase === "error" && <ErroBox msg={load.msg} />}
          {load.fase === "done" && load.dados.length === 0 && (
            <p className="text-[11px] italic text-muted-foreground">
              Nenhum conjunto de anúncios nesta campanha.
            </p>
          )}
          {load.fase === "done" && load.dados.length > 0 && (
            <>
              <p className="text-[11px] text-muted-foreground">
                Estes são os <strong className="text-foreground">conjuntos</strong> dentro
                desta campanha (público e orçamento). Abra um pra ver os anúncios.
              </p>
              {load.dados.map((a) => (
                <AdSetRow key={a.id} adset={a} campanhaId={campanhaId} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AdSetRow({ adset, campanhaId }: { adset: AdSetDrill; campanhaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [load, setLoad] = useState<Load<AdDrill[]>>({ fase: "idle" });

  async function toggle() {
    const proximo = !aberto;
    setAberto(proximo);
    if (proximo && load.fase === "idle") {
      setLoad({ fase: "loading" });
      const res = await getAdSetAdsAction(adset.id, campanhaId);
      if ("error" in res) setLoad({ fase: "error", msg: res.error });
      else setLoad({ fase: "done", dados: res.ads });
    }
  }

  return (
    <div className="rounded-md border-l-2 border-l-primary/40 bg-card">
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{adset.nome}</span>
          <StatusPill effective={adset.effective_status} />
        </div>
        <MetricaResumo fonte={adset.metricas} size="sm" />
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-90" : ""}`}
          />
          Ver anúncios
        </button>
      </div>

      {aberto && (
        <div className="space-y-2 border-t px-3 py-3">
          {load.fase === "loading" && (
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando anúncios no Meta…
            </p>
          )}
          {load.fase === "error" && <ErroBox msg={load.msg} />}
          {load.fase === "done" && load.dados.length === 0 && (
            <p className="text-[11px] italic text-muted-foreground">
              Nenhum anúncio neste conjunto.
            </p>
          )}
          {load.fase === "done" && load.dados.length > 0 && (
            <>
              <p className="text-[11px] text-muted-foreground">
                Estes são os <strong className="text-foreground">anúncios</strong> (o criativo
                que as pessoas veem) deste conjunto.
              </p>
              {load.dados.map((ad) => (
                <AdRow key={ad.id} ad={ad} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AdRow({ ad }: { ad: AdDrill }) {
  return (
    <div className="flex gap-3 rounded-md border-l-2 border-l-muted-foreground/30 bg-muted/10 p-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {ad.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.thumbnailUrl} alt={ad.nome} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{ad.nome}</span>
          <StatusPill effective={ad.effective_status} />
        </div>
        <MetricaResumo fonte={ad.metricas} size="sm" />
      </div>
    </div>
  );
}
