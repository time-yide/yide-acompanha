import { CANAIS, CANAL_LABEL, type CanaisResultado, type CanalId } from "@/lib/dados/tipos";
import { CanalIcone } from "./CanalIcone";

const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR") : "—");
const brl = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
const varPct = (a: unknown, b: unknown) =>
  typeof a === "number" && typeof b === "number" && b > 0 ? Math.round(((a - b) / b) * 100) : null;

function linhas(canal: CanalId, m: Record<string, number | string | null>): Array<[string, string, number | null]> {
  switch (canal) {
    case "site": return [["Visitas", n(m.sessoes), varPct(m.sessoes, m.sessoesAnt)]];
    case "google": return [["Cliques", n(m.cliques), varPct(m.cliques, m.cliquesAnt)], ["Posição média", typeof m.posicao === "number" ? `${Math.round(m.posicao)}ª` : "—", null]];
    case "gmn": return [["Nota", typeof m.nota === "number" ? `${m.nota.toFixed(1)} ★` : "—", null], ["Avaliações", n(m.avaliacoes), null], ["Novas no período", n(m.avaliacoesNovas), null]];
    case "instagram":
    case "facebook": return [["Posts no período", n(m.postsPeriodo), null], ["Último post", typeof m.ultimoPost === "string" ? new Date(m.ultimoPost).toLocaleDateString("pt-BR") : "—", null]];
    case "anuncios": return [["Investido", brl(m.gasto), null], ["Cliques", n(m.cliques), null], ["Investido (7 dias)", brl(m.gasto7d), null]];
    case "ecommerce": return [["Anúncios novos", n(m.anuncios), varPct(m.anuncios, m.anunciosAnt)]];
    case "crm": {
      const origens = typeof m.origens === "string" ? (JSON.parse(m.origens) as Record<string, number>) : {};
      const top = Object.entries(origens).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${ORIGEM[k] ?? k} ${v}`).join(" · ");
      return [
        ["Leads novos", n(m.leadsNovos), varPct(m.leadsNovos, m.leadsNovosAnt)],
        ["Vendas", `${n(m.vendas)} (${brl(m.valorVendas)})`, null],
        ["Conversão", typeof m.conversao === "number" ? `${Math.round(m.conversao * 100)}%` : "—", null],
        ["Sem resposta +24h", n(m.semResposta24h), null],
        ["De onde vêm", top || "—", null],
      ];
    }
  }
}
const ORIGEM: Record<string, string> = { google: "Google", meta_ads: "Anúncios Meta", instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", mercado_livre: "Mercado Livre", outros: "Outros" };

export function CanalCards({ canais }: { canais: CanaisResultado }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CANAIS.filter((c) => canais[c].status !== "nao_se_aplica").map((c) => {
        const r = canais[c];
        return (
          <div key={c} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium"><CanalIcone canal={c} r={r} size="sm" />{CANAL_LABEL[c]}</div>
            {r.status === "sem_acesso" || r.status === "ausente"
              ? <p className="text-xs text-white/50">{r.motivo}</p>
              : (
                <dl className="space-y-1 text-sm">
                  {linhas(c, r.metricas).map(([k, v, d]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-white/50">{k}</dt>
                      <dd className="text-right tabular-nums">{v}{d != null && <span className={d >= 0 ? "ml-1 text-xs text-emerald-300" : "ml-1 text-xs text-rose-300"}>{d >= 0 ? `+${d}%` : `${d}%`}</span>}</dd>
                    </div>
                  ))}
                </dl>
              )}
          </div>
        );
      })}
    </div>
  );
}
