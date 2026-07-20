"use client";

import { useState, useTransition } from "react";
import { Pencil, ExternalLink, Archive, Plus, Settings2, LinkIcon, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CampanhaFormModal } from "./CampanhaFormModal";
import { ConfigMetricasModal } from "./ConfigMetricasModal";
import { AdAccountsModal } from "./AdAccountsModal";
import { PublicarMetaModal } from "./PublicarMetaModal";
import { archiveCampanhaAction } from "@/lib/trafego/actions";
import { objetivoParaMeta } from "@/lib/trafego/meta-create-map";
import {
  STATUS_LABELS, STATUS_COLORS, OBJETIVOS,
  METRICA_BY_KEY, formatMetricaValor,
} from "@/lib/trafego/metricas";
import type { CampanhaRow } from "@/lib/trafego/queries";

interface Props {
  clientId: string;
  clientNome: string;
  metaAdAccountId: string | null;
  googleAdsCustomerId: string | null;
  facebookPageId: string | null;
  campanhas: CampanhaRow[];
  metricasVisiveis: string[];
  /** Por enquanto vazio (Fase 2 vai popular). Map: campanhaId → { metricKey: agregado }. */
  agregados: Record<string, Record<string, number>>;
  canManage: boolean;
}

const objetivosLabel: Record<string, string> = Object.fromEntries(
  OBJETIVOS.map((o) => [o.value, o.label]),
);

export function CampanhasList({
  clientId, clientNome, metaAdAccountId, googleAdsCustomerId, facebookPageId,
  campanhas, metricasVisiveis, agregados, canManage,
}: Props) {
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<CampanhaRow | null>(null);
  const [openMetricas, setOpenMetricas] = useState(false);
  const [openAccounts, setOpenAccounts] = useState(false);

  function novaCampanha() {
    setEditing(null);
    setOpenForm(true);
  }

  function editarCampanha(c: CampanhaRow) {
    setEditing(c);
    setOpenForm(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button size="sm" onClick={novaCampanha}>
              <Plus className="h-4 w-4" /> Nova campanha
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setOpenMetricas(true)}>
            <Settings2 className="h-4 w-4" /> Configurar métricas
          </Button>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setOpenAccounts(true)}>
              <LinkIcon className="h-4 w-4" /> Contas de anúncios
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {campanhas.length} campanha{campanhas.length === 1 ? "" : "s"}
        </div>
      </div>

      {campanhas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma campanha cadastrada.{canManage && " Clica em \"Nova campanha\" pra começar."}
        </Card>
      ) : (
        <div className="space-y-3">
          {campanhas.map((c) => (
            <CampanhaCard
              key={c.id}
              campanha={c}
              metricasVisiveis={metricasVisiveis}
              agregado={agregados[c.id] ?? {}}
              canManage={canManage}
              clientHasAdAccount={!!metaAdAccountId}
              clientHasPage={!!facebookPageId}
              onEdit={() => editarCampanha(c)}
            />
          ))}
        </div>
      )}

      {openForm && (
        <CampanhaFormModal
          open={openForm}
          onOpenChange={setOpenForm}
          clientId={clientId}
          campanha={editing}
        />
      )}
      {openMetricas && (
        <ConfigMetricasModal
          open={openMetricas}
          onOpenChange={setOpenMetricas}
          initial={metricasVisiveis}
        />
      )}
      {openAccounts && (
        <AdAccountsModal
          open={openAccounts}
          onOpenChange={setOpenAccounts}
          clientId={clientId}
          clientNome={clientNome}
          initial={{
            meta_ad_account_id: metaAdAccountId,
            google_ads_customer_id: googleAdsCustomerId,
          }}
        />
      )}
    </>
  );
}

/** Link pro Gerenciador de Anúncios de uma campanha já publicada. */
function gerenciadorUrl(campaignId: string, accountId: string | null): string {
  const act = (accountId ?? "").replace(/^act_/, "");
  return `https://business.facebook.com/adsmanager/manage/campaigns?act=${act}&selected_campaign_ids=${campaignId}`;
}

function CampanhaCard({
  campanha, metricasVisiveis, agregado, canManage, clientHasAdAccount, clientHasPage, onEdit,
}: {
  campanha: CampanhaRow;
  metricasVisiveis: string[];
  agregado: Record<string, number>;
  canManage: boolean;
  clientHasAdAccount: boolean;
  clientHasPage: boolean;
  onEdit: () => void;
}) {
  const [pendingArchive, startArchive] = useTransition();
  const [openPublicar, setOpenPublicar] = useState(false);

  const jaPublicada = !!campanha.external_ad_id;
  const objetivoSuportado = !!objetivoParaMeta(campanha.objetivo);
  const temCriativo = !!campanha.criativo_url && !!campanha.link_destino;
  const podePublicar =
    canManage &&
    campanha.plataforma === "meta" &&
    !jaPublicada &&
    objetivoSuportado &&
    temCriativo &&
    clientHasAdAccount &&
    clientHasPage;

  // Motivo pra desabilitar (tooltip), quando é Meta e ainda não publicou.
  let motivoBloqueio: string | null = null;
  if (canManage && campanha.plataforma === "meta" && !jaPublicada) {
    if (!objetivoSuportado) motivoBloqueio = "Objetivo não suportado (use Tráfego ou Engajamento)";
    else if (!campanha.criativo_url) motivoBloqueio = "Adicione a URL do criativo (imagem)";
    else if (!campanha.link_destino) motivoBloqueio = "Adicione o link de destino";
    else if (!clientHasAdAccount) motivoBloqueio = "Cadastre a conta de anúncios do cliente";
    else if (!clientHasPage) motivoBloqueio = "Cadastre a página do Facebook do cliente";
  }

  function arquivar() {
    if (!confirm(`Arquivar a campanha "${campanha.nome}"?`)) return;
    const fd = new FormData();
    fd.set("id", campanha.id);
    startArchive(async () => {
      await archiveCampanhaAction(fd);
    });
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-tight">{campanha.nome}</h3>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[campanha.status] ?? ""}`}
            >
              {STATUS_LABELS[campanha.status] ?? campanha.status}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {campanha.plataforma === "meta" ? "Meta" : "Google"}
            </Badge>
            {campanha.objetivo && (
              <Badge variant="outline" className="text-[10px]">
                {objetivosLabel[campanha.objetivo] ?? campanha.objetivo}
              </Badge>
            )}
          </div>
          {campanha.publico_alvo && (
            <p className="text-[11px] text-muted-foreground">{campanha.publico_alvo}</p>
          )}
        </div>
        <div className="flex gap-1">
          {campanha.link_destino && (
            <a
              href={campanha.link_destino}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
              title="Abrir link de destino"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {canManage && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={arquivar}
                disabled={pendingArchive}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted disabled:opacity-50"
                title="Arquivar"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Datas e budgets */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        {campanha.data_inicio && (
          <span>
            <strong className="text-foreground">Início:</strong>{" "}
            {new Date(campanha.data_inicio).toLocaleDateString("pt-BR")}
          </span>
        )}
        {campanha.data_fim && (
          <span>
            <strong className="text-foreground">Fim:</strong>{" "}
            {new Date(campanha.data_fim).toLocaleDateString("pt-BR")}
          </span>
        )}
        {campanha.budget_diario != null && (
          <span>
            <strong className="text-foreground">Budget/dia:</strong>{" "}
            {formatMetricaValor(Number(campanha.budget_diario), "moeda")}
          </span>
        )}
        {campanha.budget_total != null && (
          <span>
            <strong className="text-foreground">Budget total:</strong>{" "}
            {formatMetricaValor(Number(campanha.budget_total), "moeda")}
          </span>
        )}
      </div>

      {/* Publicar no Meta (pausado) — só Meta */}
      {campanha.plataforma === "meta" && canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {jaPublicada ? (
            <a
              href={gerenciadorUrl(campanha.external_campaign_id ?? "", campanha.external_account_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
            >
              <Megaphone className="h-3.5 w-3.5" /> Publicado (pausado) — abrir no Gerenciador
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={!podePublicar}
                title={motivoBloqueio ?? undefined}
                onClick={() => setOpenPublicar(true)}
              >
                <Megaphone className="h-4 w-4" /> Publicar no Meta
              </Button>
              {motivoBloqueio && (
                <span className="text-[11px] text-muted-foreground">{motivoBloqueio}</span>
              )}
            </>
          )}
        </div>
      )}

      {openPublicar && (
        <PublicarMetaModal
          open={openPublicar}
          onOpenChange={setOpenPublicar}
          campanha={campanha}
        />
      )}

      {/* Métricas */}
      {metricasVisiveis.length > 0 && (
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {metricasVisiveis.map((key) => {
              const def = METRICA_BY_KEY[key];
              if (!def) return null;
              const v = agregado[key];
              return (
                <div key={key} className="space-y-0.5">
                  <p
                    className="text-[10px] uppercase tracking-wider text-muted-foreground truncate"
                    title={def.label}
                  >
                    {def.label}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatMetricaValor(v ?? null, def.unidade)}
                  </p>
                </div>
              );
            })}
          </div>
          {Object.keys(agregado).length === 0 && (
            <p className="mt-3 text-[10px] text-muted-foreground italic">
              Sem dados de métricas ainda. Na Fase 2 esses números serão preenchidos automaticamente
              a partir das APIs do Meta/Google.
            </p>
          )}
        </div>
      )}

      {campanha.copy && (
        <details className="rounded-md border bg-muted/10 px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">
            Copy
          </summary>
          <p className="mt-2 text-xs whitespace-pre-wrap text-foreground/80">{campanha.copy}</p>
        </details>
      )}
    </Card>
  );
}
