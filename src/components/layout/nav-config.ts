import {
  LayoutGrid, Users, KanbanSquare, ListChecks,
  DollarSign, Calendar, UserCog, MessageSquare,
  TrendingUp, Video, Trash2, MessagesSquare, GraduationCap, Megaphone, Share2, Radar, MessageCircle, Phone,
  IdCard, Rocket, BookOpen, Inbox, Activity, Layers,
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
  /** Quando true, o grupo não pode ser minimizado — sem botão de toggle. */
  alwaysExpanded?: boolean;
}

export type NavEntry = NavLink | NavGroup;

/**
 * Estrutura do menu lateral. Mistura links top-level (Dashboard) com
 * grupos recolhíveis (Comercial, Operação, etc.). Cada grupo armazena
 * sua preferência aberto/fechado em localStorage por id.
 */
export const NAV_STRUCTURE: readonly NavEntry[] = [
  { type: "link", href: "/", icon: LayoutGrid, label: "Dashboard", roles: "all", badgeKey: null },

  // Comunicação fica direto embaixo do Dashboard e não pode ser minimizada —
  // decisão da Yasmin: recados e escritório precisam estar sempre visíveis
  // pra não atrapalhar a comunicação interna do time.
  {
    type: "group",
    id: "comunicacao",
    label: "Comunicação",
    alwaysExpanded: true,
    items: [
      { type: "link", href: "/recados", icon: MessageSquare, label: "Recados", roles: "all", badgeKey: "recados" },
      { type: "link", href: "/escritorio", icon: MessagesSquare, label: "Escritório Virtual", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"], badgeKey: "escritorio" },
    ],
  },

  {
    type: "group",
    id: "comercial",
    label: "Comercial",
    items: [
      // "Clientes" foi pra Operação (decisão Yasmin: ela já é o "núcleo" da operação, não do comercial).
      { type: "link", href: "/gerador-leads", icon: Radar, label: "Gerador de Leads", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      { type: "link", href: "/conversas", icon: MessageCircle, label: "Conversas", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      { type: "link", href: "/ligacoes", icon: Phone, label: "Ligações", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      // "Reuniões" saiu do menu — agora aparece como aba dentro de Onboarding. URL /reunioes preservada.
      // LGPD: dados de prospects/leads (telefone, email, valor) só pra quem
      // precisa operar - comercial cria/contata, assessor/coord acompanham,
      // audiovisual_chefe é coord audiovisual. Designer/videomaker/editor não veem.
      { type: "link", href: "/onboarding", icon: KanbanSquare, label: "Onboarding", roles: ["adm", "socio", "comercial", "assessor", "coordenador", "audiovisual_chefe"], badgeKey: null },
      // "Prospecção" saiu do menu — agora aparece como aba dentro de Onboarding. URL /prospeccao preservada.
    ],
  },

  {
    type: "group",
    id: "operacao",
    label: "Operação",
    items: [
      // Clientes no topo da Operação (decisão Yasmin: é o coração do dia-a-dia operacional).
      { type: "link", href: "/clientes", icon: Users, label: "Clientes", roles: "all", badgeKey: null },
      // D0 → D30 vem depois - é o fluxo de entrada/onboarding do cliente.
      { type: "link", href: "/d0-d30", icon: Rocket, label: "D0 → D30", roles: ["adm", "socio", "coordenador", "assessor", "comercial"], badgeKey: null },
      { type: "link", href: "/tarefas", icon: ListChecks, label: "Tarefas", roles: "all", badgeKey: null },
      { type: "link", href: "/audiovisual", icon: Video, label: "Audiovisual", roles: ["adm", "socio", "coordenador", "assessor", "videomaker", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/trafego", icon: Megaphone, label: "Tráfego", roles: ["adm", "socio", "coordenador", "assessor", "comercial"], badgeKey: null },
      // Label "Estratégia" — engloba Painel Mensal + Agendamento de Post + Design + Apresenta Yide.
      // URL /social-media preservada (redirect pro /painel).
      { type: "link", href: "/social-media", icon: Share2, label: "Estratégia", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"], badgeKey: null },
      // "CRM" e "Painel GMB" saíram do menu — aparecem como abas dentro de Tráfego. URLs preservadas.
      // "Design" e "Painel mensal" saíram do menu — aparecem como abas dentro de Social Media. URLs /design e /painel preservadas.
      { type: "link", href: "/painel-cliente", icon: IdCard, label: "Painel do cliente", roles: ["adm", "socio"], badgeKey: null },
      // "Satisfação" saiu do menu — agora aparece como aba dentro de Painel do cliente. URL /satisfacao preservada.
      { type: "link", href: "/solicitacoes", icon: Inbox, label: "Solicitações", roles: ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/calendario", icon: Calendar, label: "Calendário Interno", roles: "all", badgeKey: null },
    ],
  },

  {
    type: "group",
    // id continua "equipe" pra preservar a preferência de aberto/fechado
    // que o usuário já tem salva em localStorage. Só o label muda.
    id: "equipe",
    label: "Interno",
    items: [
      { type: "link", href: "/manual", icon: BookOpen, label: "Manual da Yide", roles: "all", badgeKey: null },
      { type: "link", href: "/academy", icon: GraduationCap, label: "Yide Academy", roles: "all", badgeKey: null },
      { type: "link", href: "/colaboradores", icon: UserCog, label: "Colaboradores", roles: "all", badgeKey: null },
      { type: "link", href: "/produtividade", icon: Activity, label: "Produtividade", roles: ["adm", "socio", "coordenador", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/unidades", icon: Layers, label: "Unidades", roles: ["adm", "socio"], badgeKey: null },
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
