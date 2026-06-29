/**
 * Constantes do módulo Social Media (estilo mLabs).
 *
 * Fase 1: cadastro + agendamento manual (NÃO publica ainda).
 * Fase 2: publicação automática via Meta Graph API (Instagram + Facebook).
 * Fase 3: link público de aprovação do cliente.
 * Fase 4: LinkedIn + GMN + inbox unificada.
 */

export type Rede = "instagram" | "facebook" | "linkedin" | "gmn" | "tiktok" | "youtube";

export interface RedeDef {
  value: Rede;
  label: string;
  /** Cor do badge (Tailwind classes). */
  color: string;
  /** Quando true, ainda não tem publicação automática (Fase 4). */
  comingSoon?: boolean;
}

export const REDES: RedeDef[] = [
  {
    value: "instagram",
    label: "Instagram",
    color: "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  },
  {
    value: "facebook",
    label: "Facebook",
    color: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    color: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    value: "tiktok",
    label: "TikTok",
    color: "border-foreground/30 bg-foreground/10 text-foreground",
  },
  {
    value: "youtube",
    label: "YouTube",
    color: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  {
    value: "gmn",
    label: "Google Meu Negócio",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    comingSoon: true,
  },
];

export const REDE_BY_VALUE: Record<string, RedeDef> = Object.fromEntries(
  REDES.map((r) => [r.value, r]),
);

export const FORMATOS = [
  { value: "feed",      label: "Feed",       descricao: "Imagem ou vídeo no feed" },
  { value: "carrossel", label: "Carrossel",  descricao: "Múltiplas imagens" },
  { value: "story",     label: "Story",      descricao: "Story 24h" },
  { value: "reels",     label: "Reels",      descricao: "Vídeo vertical" },
] as const;

export const STATUS_DEFS: Record<string, { label: string; color: string }> = {
  rascunho: {
    label: "Rascunho",
    color: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  },
  aguardando_aprovacao: {
    label: "Aguardando cliente",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  aprovado: {
    label: "Aprovado",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  ajustes_solicitados: {
    label: "Ajustes pedidos",
    color: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  agendado: {
    label: "Agendado",
    color: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  publicado: {
    label: "Publicado",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  falha: {
    label: "Falha",
    color: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

export const STATUS_VALORES = [
  "rascunho",
  "aguardando_aprovacao",
  "aprovado",
  "ajustes_solicitados",
  "agendado",
  "publicado",
  "falha",
] as const;
