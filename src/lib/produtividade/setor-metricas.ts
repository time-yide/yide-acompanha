// Módulo PURO e client-safe — só cálculo/rotulagem por setor, sem imports de
// server (service-role/next-cache). O fetch (getProdutividadeSetor) vive em
// setor-metricas-server.ts pra não vazar código de servidor em client components
// (a ColaboradoresTable importa isRoleAudiovisual daqui).

export type Setor = "comercial" | "ecommerce" | "assessoria" | "design" | "audiovisual" | "programacao";

export interface MetricaCrua {
  ligacoes_feitas: number;
  ligacoes_atendidas: number;
  anuncios: number;
  tarefas_entregues: number;
  tarefas_no_prazo: number;
  tarefas_com_prazo: number;
  tarefas_atrasadas: number;
  postagens: number;
  artes: number;
  prog_crm: number;
  prog_usuarios: number;
  prog_sistemas: number;
  prog_total: number;
}

export interface MetricaPessoa {
  setor: Setor | null;
  valor: number | null; // contagem, ou % (0-100); null = sem dado
  unidade: "contagem" | "percentual";
  rotulo: string; // "45 ligações" | "92% no prazo" | "—"
}

const AUDIOVISUAL = new Set(["videomaker", "editor", "fast_midia", "audiovisual_chefe"]);
const ECOMMERCE = new Set(["assessor_ecommerce", "assistente_ecommerce"]);

/** Produtores audiovisuais individuais. EXCLUI `audiovisual_chefe` de propósito:
 *  o coordenador entra no setor "audiovisual" (roleParaSetor) mas NÃO usa o
 *  fallback de "entregas" na tabela. NÃO troque por `AUDIOVISUAL.has(role)`. */
export function isRoleAudiovisual(role: string): boolean {
  return role === "videomaker" || role === "editor" || role === "fast_midia";
}

export function roleParaSetor(role: string, especialidade?: string | null): Setor | null {
  if (role === "comercial") return "comercial";
  if (ECOMMERCE.has(role)) return "ecommerce";
  if (role === "assessor") return especialidade === "ecommerce" ? "ecommerce" : "assessoria";
  if (role === "designer") return "design";
  if (role === "programacao") return "programacao";
  if (AUDIOVISUAL.has(role)) return "audiovisual";
  return null;
}

export function pctNoPrazo(noPrazo: number, comPrazo: number): number | null {
  if (comPrazo <= 0) return null;
  return (noPrazo / comPrazo) * 100;
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function resolveMetricaPessoa(
  role: string,
  especialidade: string | null,
  c: MetricaCrua,
): MetricaPessoa {
  const setor = roleParaSetor(role, especialidade);
  switch (setor) {
    case "comercial":
      return { setor, valor: c.ligacoes_feitas, unidade: "contagem", rotulo: plural(c.ligacoes_feitas, "ligação", "ligações") };
    case "ecommerce":
      return { setor, valor: c.anuncios, unidade: "contagem", rotulo: plural(c.anuncios, "anúncio", "anúncios") };
    case "assessoria": {
      const pct = pctNoPrazo(c.tarefas_no_prazo, c.tarefas_com_prazo);
      return {
        setor,
        valor: pct,
        unidade: "percentual",
        rotulo: pct === null ? "—" : `${Math.round(pct)}% no prazo`,
      };
    }
    case "design":
      return { setor, valor: c.artes, unidade: "contagem", rotulo: plural(c.artes, "arte", "artes") };
    case "programacao":
      return { setor, valor: c.prog_total, unidade: "contagem", rotulo: plural(c.prog_total, "entrega", "entregas") };
    default:
      // audiovisual usa "entregas" (renderizado na tabela via row.entregas_periodo);
      // gestão/programação/sem setor → "—".
      return { setor, valor: null, unidade: "contagem", rotulo: "—" };
  }
}
