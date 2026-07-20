"use client";

import { useState, useMemo, useTransition } from "react";
import { Pencil, ExternalLink, Archive, Plus, Settings2, LinkIcon, Megaphone, Search, X } from "lucide-react";
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

/** Objetivos crus do Meta (sincronizados) → rótulo pt-br. */
const META_OBJETIVO_LABEL: Record<string, string> = {
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Vendas/Conversões",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_APP_PROMOTION: "App",
};

function objetivoLabel(valor: string): string {
  return objetivosLabel[valor] ?? META_OBJETIVO_LABEL[valor] ?? valor;
}

/** Opções do filtro de status na barra. */
const STATUS_FILTRO: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "ativa", label: "Ativa" },
  { value: "pausada", label: "Pausada" },
  { value: "finalizada", label: "Finalizada" },
  { value: "rascunho", label: "Rascunho" },
];

/** [aInicio,aFim] intercepta [bDe,bAte]? Datas em "YYYY-MM-DD" comparáveis como string. */
function intervaloIntercepta(
  aInicio: string | null,
  aFim: string | null,
  bDe: string,
  bAte: string,
): boolean {
  // Sem filtro de data: sempre passa.
  if (!bDe && !bAte) return true;
  // Campanha sem nenhuma data e há filtro ativo: não inclui.
  if (!aInicio && !aFim) return false;
  const ini = (aInicio ?? aFim!).slice(0, 10);
  const fim = (aFim ?? aInicio!).slice(0, 10);
  if (bDe && fim < bDe) return false;
  if (bAte && ini > bAte) return false;
  return true;
}

export function CampanhasList({
  clientId, clientNome, metaAdAccountId, googleAdsCustomerId, facebookPageId,
  campanhas, metricasVisiveis, agregados, canManage,
}: Props) {
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<CampanhaRow | null>(null);
  const [openMetricas, setOpenMetricas] = useState(false);
  const [openAccounts, setOpenAccounts] = useState(false);

  // Filtros client-side (a lista já vem toda carregada em props).
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");

  const temFiltro = !!(filtroDe || filtroAte || filtroStatus || busca.trim());

  const campanhasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return campanhas.filter((c) => {
      if (filtroStatus && c.status !== filtroStatus) return false;
      if (termo && !c.nome.toLowerCase().includes(termo)) return false;
      if (!intervaloIntercepta(c.data_inicio, c.data_fim, filtroDe, filtroAte)) return false;
      return true;
    });
  }, [campanhas, filtroDe, filtroAte, filtroStatus, busca]);

  function limparFiltros() {
    setFiltroDe("");
    setFiltroAte("");
    setFiltroStatus("");
    setBusca("");
  }

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
          {temFiltro
            ? `${campanhasFiltradas.length} de ${campanhas.length} campanha${campanhas.length === 1 ? "" : "s"}`
            : `${campanhas.length} campanha${campanhas.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {campanhas.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
          <div className="relative min-w-[180px] flex-1">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Buscar
            </label>
            <Search className="pointer-events-none absolute left-2 top-[26px] h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome da campanha"
              className="h-8 w-full rounded-md border bg-card pl-7 pr-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              De
            </label>
            <input
              type="date"
              value={filtroDe}
              onChange={(e) => setFiltroDe(e.target.value)}
              className="h-8 rounded-md border bg-card px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Até
            </label>
            <input
              type="date"
              value={filtroAte}
              onChange={(e) => setFiltroAte(e.target.value)}
              className="h-8 rounded-md border bg-card px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="h-8 rounded-md border bg-card px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {STATUS_FILTRO.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {temFiltro && (
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      )}

      {campanhas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma campanha cadastrada.{canManage && " Clica em \"Nova campanha\" pra começar."}
        </Card>
      ) : campanhasFiltradas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma campanha para os filtros escolhidos.
          {temFiltro && (
            <button
              type="button"
              onClick={limparFiltros}
              className="ml-1 underline underline-offset-2 hover:text-foreground"
            >
              Limpar filtros
            </button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {campanhasFiltradas.map((c) => (
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

  // Existe no Meta (sincronizada OU criada por nós): tem id de campanha externo.
  const jaNoMeta = !!campanha.external_campaign_id;
  const objetivoSuportado = !!objetivoParaMeta(campanha.objetivo);
  const temCriativo = !!campanha.criativo_url && !!campanha.link_destino;
  const podePublicar =
    canManage &&
    campanha.plataforma === "meta" &&
    !jaNoMeta &&
    objetivoSuportado &&
    temCriativo &&
    clientHasAdAccount &&
    clientHasPage;

  // Motivo pra desabilitar (tooltip), quando é Meta e ainda não foi pro Meta.
  let motivoBloqueio: string | null = null;
  if (canManage && campanha.plataforma === "meta" && !jaNoMeta) {
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
                {objetivoLabel(campanha.objetivo)}
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

      {/* Meta: já no Meta → link discreto pro Gerenciador; rascunho local → botão Publicar */}
      {jaNoMeta ? (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={gerenciadorUrl(campanha.external_campaign_id ?? "", campanha.external_account_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" /> Abrir no Gerenciador
          </a>
        </div>
      ) : campanha.plataforma === "meta" && canManage ? (
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      ) : null}

      {openPublicar && (
        <PublicarMetaModal
          open={openPublicar}
          onOpenChange={setOpenPublicar}
          campanha={campanha}
        />
      )}

      {/* Métricas — só quando há dados agregados */}
      {metricasVisiveis.length > 0 && Object.keys(agregado).length > 0 && (
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
