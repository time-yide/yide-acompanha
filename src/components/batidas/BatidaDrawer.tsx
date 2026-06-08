"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Phone, MessageCircle, Mail, MapPin, MoreHorizontal } from "lucide-react";
import type { ProspectoCadencia } from "@/lib/batidas/aggregate";
import type { BatidaTimelineItem } from "@/lib/batidas/queries";
import { carregarTimelineAction } from "@/app/(authed)/batidas/timeline-action";
import { registrarBatidaAction, descartarProspectoAction } from "@/lib/batidas/actions";

interface Props {
  prospecto: ProspectoCadencia;
  onClose: () => void;
}

const CANAIS = [
  { value: "ligacao", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "presencial", label: "Presencial" },
  { value: "email", label: "Email" },
  { value: "outro", label: "Outro" },
];
const RESULTADOS = [
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "agendou", label: "Agendou" },
  { value: "recusou", label: "Recusou" },
  { value: "pediu_proposta", label: "Pediu proposta" },
  { value: "outro", label: "Outro" },
];

function iconeCanal(canal: string) {
  if (canal === "presencial") return <MapPin className="h-4 w-4" />;
  if (canal === "whatsapp") return <MessageCircle className="h-4 w-4" />;
  if (canal === "email") return <Mail className="h-4 w-4" />;
  if (canal === "ligacao" || canal === "telefone") return <Phone className="h-4 w-4" />;
  return <MoreHorizontal className="h-4 w-4" />;
}

export function BatidaDrawer({ prospecto, onClose }: Props) {
  const [timeline, setTimeline] = useState<BatidaTimelineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const visitaId = prospecto.visitaId;
  const visitaData = prospecto.visitaData;

  useEffect(() => {
    carregarTimelineAction({
      leadGeradoId: prospecto.leadGeradoId,
      leadId: prospecto.leadId,
      visitaId,
      visitaData,
    }).then(setTimeline);
  }, [prospecto.leadGeradoId, prospecto.leadId, visitaId, visitaData]);

  function setAlvo(fd: FormData) {
    if (prospecto.leadGeradoId) fd.set("lead_gerado_id", prospecto.leadGeradoId);
    else if (prospecto.leadId) fd.set("lead_id", prospecto.leadId);
  }

  function onRegistrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setAlvo(fd);
    const formEl = e.currentTarget;
    startTransition(async () => {
      const r = await registrarBatidaAction(fd);
      if ("error" in r) setError(r.error);
      else {
        formEl.reset();
        const tl = await carregarTimelineAction({
          leadGeradoId: prospecto.leadGeradoId, leadId: prospecto.leadId, visitaId, visitaData,
        });
        setTimeline(tl);
      }
    });
  }

  function onDescartar() {
    const motivo = window.prompt("Motivo do descarte:");
    if (!motivo || motivo.trim().length < 3) return;
    const fd = new FormData();
    setAlvo(fd);
    fd.set("motivo", motivo.trim());
    startTransition(async () => {
      const r = await descartarProspectoAction(fd);
      if ("error" in r) setError(r.error);
      else onClose();
    });
  }

  const pct = Math.min(100, Math.round((prospecto.totalBatidas / prospecto.meta) * 100));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{prospecto.nome}</h2>
            <p className="text-xs text-muted-foreground">{prospecto.canal === "rua" ? "Comercial Rua" : "Comercial Ligação"}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span className="tabular-nums">{prospecto.totalBatidas}/{prospecto.meta}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${prospecto.esgotou ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {prospecto.temSucesso && (
          <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            🎉 Prospecto convertido — cadência encerrada.
          </div>
        )}
        {prospecto.esgotou && (
          <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            ⚠️ Esgotou as 14 batidas sem sucesso.
            <button onClick={onDescartar} disabled={pending} className="mt-2 block rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:opacity-90 disabled:opacity-50">
              Marcar como perdido / descartar
            </button>
          </div>
        )}

        {!prospecto.temSucesso && (
          <form onSubmit={onRegistrar} className="mb-5 space-y-2 rounded-lg border bg-card p-3">
            <h3 className="text-sm font-semibold">Registrar batida</h3>
            <div className="grid grid-cols-2 gap-2">
              <select name="canal" required defaultValue="ligacao" className="h-9 rounded-md border bg-card px-2 text-sm">
                {CANAIS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select name="resultado" required defaultValue="sem_resposta" className="h-9 rounded-md border bg-card px-2 text-sm">
                {RESULTADOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <textarea name="observacao" rows={2} placeholder="Observação" className="w-full rounded-md border bg-card px-2 py-1.5 text-sm" />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button type="submit" disabled={pending} className="w-full rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {pending ? "Salvando..." : "Registrar batida"}
            </button>
          </form>
        )}

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h3>
        {timeline === null ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : timeline.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma batida ainda.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.map((it, i) => (
              <li key={i} className="flex gap-2 rounded-md border bg-card p-2 text-sm">
                <span className="mt-0.5 text-muted-foreground">{iconeCanal(it.canal)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {it.numero ? `#${it.numero} ` : ""}{it.rotulo}
                      {!it.conta && <span className="ml-1 text-[10px] text-muted-foreground">(não conta)</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(it.data).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {it.observacao && <p className="text-xs text-muted-foreground">{it.observacao}</p>}
                  {it.autorNome && <p className="text-[10px] text-muted-foreground">por {it.autorNome}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
