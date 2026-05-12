import {
  LayoutGrid, Users, Briefcase, KanbanSquare, ListChecks,
  DollarSign, Smile, Calendar, UserCog, ClipboardList, MessageSquare,
  TrendingUp, Video, Trash2, MessagesSquare, GraduationCap, Megaphone, Share2, Database, Palette, Radar, MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/permissions";

export type NavBadgeKey = "recados" | "escritorio";

export interface NavLink {
  type: "link";
  href: string;
  icon: LucideIcon;
  label: string;
  roles: "all" | readonly Role[];
  badgeKey: NavBadgeKey | null;
}

export interface NavGroup {
  type: "group";
  /** ID estável usado como chave em localStorage. */
  id: string;
  label: string;
  items: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

/**
 * Estrutura do menu lateral. Mistura links top-level (Dashboard) com
 * grupos recolhíveis (Comercial, Operação, etc.). Cada grupo armazena
 * sua preferência aberto/fechado em localStorage por id.
 */
export const NAV_STRUCTURE: readonly NavEntry[] = [
  { type: "link", href: "/", icon: LayoutGrid, label: "Dashboard", roles: "all", badgeKey: null },

  {
    type: "group",
    id: "comercial",
    label: "Comercial",
    items: [
      { type: "link", href: "/clientes", icon: Users, label: "Clientes", roles: "all", badgeKey: null },
      { type: "link", href: "/gerador-leads", icon: Radar, label: "Gerador de Leads", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      { type: "link", href: "/conversas", icon: MessageCircle, label: "Conversas", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      // LGPD: dados de prospects/leads (telefone, email, valor) só pra quem
      // precisa operar — comercial cria/contata, assessor/coord acompanham,
      // audiovisual_chefe é coord audiovisual. Designer/videomaker/editor não veem.
      { type: "link", href: "/onboarding", icon: KanbanSquare, label: "Onboarding", roles: ["adm", "socio", "comercial", "assessor", "coordenador", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/prospeccao", icon: Briefcase, label: "Prospecção", roles: ["adm", "socio", "comercial"], badgeKey: null },
    ],
  },

  {
    type: "group",
    id: "operacao",
    label: "Operação",
    items: [
      { type: "link", href: "/tarefas", icon: ListChecks, label: "Tarefas", roles: "all", badgeKey: null },
      { type: "link", href: "/audiovisual", icon: Video, label: "Audiovisual", roles: ["adm", "socio", "coordenador", "assessor", "videomaker", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/trafego", icon: Megaphone, label: "Tráfego", roles: ["adm", "socio", "coordenador", "assessor", "comercial"], badgeKey: null },
      { type: "link", href: "/social-media", icon: Share2, label: "Social Media", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/crm", icon: Database, label: "CRM", roles: ["adm", "socio", "coordenador", "assessor", "comercial"], badgeKey: null },
      { type: "link", href: "/design", icon: Palette, label: "Design", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/painel", icon: ClipboardList, label: "Painel mensal", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/calendario", icon: Calendar, label: "Calendário Interno", roles: "all", badgeKey: null },
    ],
  },

  {
    type: "group",
    id: "comunicacao",
    label: "Comunicação",
    items: [
      { type: "link", href: "/recados", icon: MessageSquare, label: "Recados", roles: "all", badgeKey: "recados" },
      { type: "link", href: "/escritorio", icon: MessagesSquare, label: "Escritório Virtual", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"], badgeKey: "escritorio" },
    ],
  },

  {
    type: "group",
    id: "equipe",
    label: "Equipe",
    items: [
      { type: "link", href: "/academy", icon: GraduationCap, label: "Yide Academy", roles: "all", badgeKey: null },
      { type: "link", href: "/colaboradores", icon: UserCog, label: "Colaboradores", roles: "all", badgeKey: null },
      { type: "link", href: "/satisfacao", icon: Smile, label: "Satisfação", roles: "all", badgeKey: null },
    ],
  },

  {
    type: "group",
    id: "financeiro",
    label: "Financeiro",
    items: [
      { type: "link", href: "/comissoes", icon: DollarSign, label: "Comissões", roles: "all", badgeKey: null },
      { type: "link", href: "/financeiro", icon: TrendingUp, label: "Financeiro", roles: ["socio", "adm"], badgeKey: null },
    ],
  },

  { type: "link", href: "/lixeira", icon: Trash2, label: "Lixeira", roles: ["adm", "socio", "coordenador", "assessor"], badgeKey: null },
];

function isLinkVisible(role: Role, link: NavLink): boolean {
  return link.roles === "all" || (Array.isArray(link.roles) && link.roles.includes(role));
}

/**
 * Filtra a estrutura do menu por role. Grupos cujos itens todos sumirem
 * pra esse role também são removidos (não fica grupo vazio na tela).
 */
export function visibleNavStructure(role: Role): NavEntry[] {
  const out: NavEntry[] = [];
  for (const entry of NAV_STRUCTURE) {
    if (entry.type === "link") {
      if (isLinkVisible(role, entry)) out.push(entry);
    } else {
      const items = entry.items.filter((it) => isLinkVisible(role, it));
      if (items.length > 0) out.push({ ...entry, items });
    }
  }
  return out;
}
