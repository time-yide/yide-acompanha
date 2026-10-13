// Constantes e helpers puros (sem zod). Componentes client importam daqui
// em vez de ./schema pra não puxar o zod (~90KB) pro bundle do navegador.
// ./schema re-exporta tudo, então imports do servidor seguem funcionando.

export const TIPOS_RELACAO = ["comum", "parceria", "permuta"] as const;
export type TipoRelacaoCliente = (typeof TIPOS_RELACAO)[number];

/**
 * Modalidade do cliente:
 * - mensal: recorrente (contrato em curso, churn quando encerra)
 * - pontual: serviço único (vídeo avulso, projeto fechado) - encerra
 *   sem virar churn, conta separadamente nas métricas
 */
export const MODALIDADES = ["mensal", "pontual"] as const;
export type ModalidadeCliente = (typeof MODALIDADES)[number];

export const STATUSES = ["ativo", "churn", "em_onboarding"] as const;

/**
 * Motivos de churn (opções fixas do dropdown). O slug vai pro banco (enum
 * churn_motivo); o label é o que aparece na UI e no relatório. Ordem = ordem
 * de exibição no select.
 */
export const CHURN_MOTIVOS = [
  { slug: "preco", label: "Preço / orçamento" },
  { slug: "insatisfacao_resultado", label: "Insatisfação com resultado" },
  { slug: "insatisfacao_equipe", label: "Insatisfação com a equipe" },
  { slug: "empresa_fechou", label: "Cliente fechou / pausou a empresa" },
  { slug: "concorrente", label: "Foi pra concorrente" },
  { slug: "inadimplencia", label: "Problema financeiro (inadimplência)" },
  { slug: "contrato_encerrado", label: "Contrato pontual encerrado (fim natural)" },
] as const;

export const CHURN_MOTIVO_SLUGS = CHURN_MOTIVOS.map((m) => m.slug) as [string, ...string[]];
export type ChurnMotivo = (typeof CHURN_MOTIVOS)[number]["slug"];

/** Lookup slug → label (inclui fallback pra slug desconhecido/legado). */
export function churnMotivoLabel(slug: string | null): string {
  if (!slug) return "Sem categoria";
  return CHURN_MOTIVOS.find((m) => m.slug === slug)?.label ?? slug;
}

export const CADENCIAS_REUNIAO = ["semanal", "quinzenal", "mensal", "trimestral"] as const;
export type CadenciaReuniao = (typeof CADENCIAS_REUNIAO)[number];
