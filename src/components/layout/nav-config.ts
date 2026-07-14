import {
  LayoutGrid, Users, KanbanSquare, ListChecks,
  DollarSign, Calendar, UserCog, MessageSquare,
  TrendingUp, Video, Trash2, MessagesSquare, Share2, Radar, MessageCircle, Phone,
  IdCard, BookOpen, Inbox, Layers, Zap, MapPin, Target, ShoppingCart, Images,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/permissions";
import { canAccessEcommerce } from "@/lib/ecommerce/access";

export type NavBadgeKey = "recados" | "escritorio" | "yoriProntos";

export interface NavLink {
  type: "link";
  href: string;
  icon: LucideIcon;
  label: string;
  roles: "all" | readonly Role[];
  badgeKey: NavBadgeKey | null;
}

/** Subtítulo/divisória dentro de um grupo (ex: "Rua" no Comercial). */
export interface NavSubheader {
  type: "subheader";
  label: string;
}

export type NavGroupItem = NavLink | NavSubheader;

export interface NavGroup {
  type: "group";
  /** ID estável usado como chave em localStorage. */
  id: string;
  label: string;
  items: readonly NavGroupItem[];
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
      { type: "link", href: "/escritorio", icon: MessagesSquare, label: "Escritório Virtual", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "fast_midia", "editor", "audiovisual_chefe", "assessor_ecommerce", "assistente_ecommerce"], badgeKey: "escritorio" },
    ],
  },

  {
    type: "group",
    // id mantido ("comercial-ligacao") pra preservar a preferência aberto/fechado
    // que o usuário já tem salva em localStorage. Só o label e o conteúdo mudam.
    id: "comercial-ligacao",
    label: "Comercial",
    items: [
      { type: "link", href: "/batidas", icon: Target, label: "14 Batidas", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      { type: "link", href: "/ligacoes", icon: Phone, label: "Ligações", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      { type: "link", href: "/onboarding?canal=ligacao", icon: KanbanSquare, label: "Onboarding Ligação", roles: ["adm", "socio", "comercial", "assessor", "coordenador", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/gerador-leads", icon: Radar, label: "Gerador de Leads", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      { type: "link", href: "/conversas", icon: MessageCircle, label: "Conversas", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      // Sub-seção "Rua" dentro do Comercial.
      { type: "subheader", label: "Rua" },
      { type: "link", href: "/visitas", icon: MapPin, label: "Visitas", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      { type: "link", href: "/onboarding?canal=rua", icon: KanbanSquare, label: "Onboarding Rua", roles: ["adm", "socio", "comercial", "assessor", "coordenador", "audiovisual_chefe"], badgeKey: null },
    ],
  },

  {
    type: "group",
    id: "operacao",
    label: "Operação",
    items: [
      // Clientes no topo da Operação (decisão Yasmin: é o coração do dia-a-dia operacional).
      { type: "link", href: "/clientes", icon: Users, label: "Clientes", roles: "all", badgeKey: null },
      // D0 → D30 e Tráfego saíram do menu — agora são abas dentro da Estratégia
      // (TabsSocialMedia). URLs /d0-d30 e /trafego preservadas.
      { type: "link", href: "/tarefas", icon: ListChecks, label: "Tarefas", roles: "all", badgeKey: null },
      { type: "link", href: "/audiovisual", icon: Video, label: "Audiovisual", roles: ["adm", "socio", "coordenador", "assessor", "videomaker", "fast_midia", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/fast-media", icon: Images, label: "Fast Mídia", roles: ["adm", "socio", "coordenador", "audiovisual_chefe", "fast_midia"], badgeKey: null },
      // Yori saiu do menu — fica só dentro do Audiovisual (botão de entrada lá). URL preservada.
      { type: "link", href: "/freela-yide", icon: Zap, label: "FreelaYide", roles: ["adm", "socio", "comercial", "coordenador", "assessor", "designer", "videomaker", "fast_midia", "editor", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/ecommerce", icon: ShoppingCart, label: "E-commerce", roles: ["adm", "socio", "assessor_ecommerce", "assistente_ecommerce"], badgeKey: null },
      // Label "Estratégia" — engloba Painel Mensal + Agendamento de Post + Design + Apresenta Yide.
      // URL /social-media preservada (redirect pro /painel).
      { type: "link", href: "/social-media", icon: Share2, label: "Estratégia", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "fast_midia", "editor", "audiovisual_chefe"], badgeKey: null },
      // "CRM" e "Painel GMB" saíram do menu — aparecem como abas dentro de Tráfego. URLs preservadas.
      // "Design" e "Painel mensal" saíram do menu — aparecem como abas dentro de Social Media. URLs /design e /painel preservadas.
      // Fast Mídia chega ao Painel mensal (sua tela de stories) pelo item
      // "Estratégia" acima, que redireciona /social-media → /painel.
      { type: "link", href: "/painel-cliente", icon: IdCard, label: "Painel do cliente", roles: ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"], badgeKey: null },
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
      // Yide Academy virou aba dentro do Manual (TabsManual); Produtividade virou
      // aba dentro de Colaboradores (TabsColaboradores). URLs preservadas.
      { type: "link", href: "/manual", icon: BookOpen, label: "Manual da Yide", roles: "all", badgeKey: null },
      { type: "link", href: "/colaboradores", icon: UserCog, label: "Colaboradores", roles: "all", badgeKey: null },
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

function isLinkVisible(role: Role, link: NavLink, especialidade?: string | null): boolean {
  // Programação (cargo técnico) começa SEM acessos: nem os itens "all".
  // Cada área é liberada explicitamente quando o módulo dela for construído.
  if (role === "programacao") {
    return Array.isArray(link.roles) && link.roles.includes(role);
  }
  // E-commerce: além dos cargos dedicados, assessor comum com especialidade
  // "ecommerce" também vê (mantém cargo + comissão de assessor). Ver
  // canAccessEcommerce (fonte única com a guarda da página).
  if (link.href === "/ecommerce") return canAccessEcommerce(role, especialidade);
  return link.roles === "all" || (Array.isArray(link.roles) && link.roles.includes(role));
}

/**
 * Filtra a estrutura do menu por role (+ especialidade, pra casos como o
 * assessor de e-commerce). Grupos cujos itens todos sumirem pra esse role
 * também são removidos (não fica grupo vazio na tela).
 */
/** Remove subtítulos órfãos: divisória sem nenhum link visível abaixo dela
 * (antes do próximo subtítulo ou do fim). */
function stripOrphanSubheaders(items: NavGroupItem[]): NavGroupItem[] {
  const out: NavGroupItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.type === "subheader") {
      let hasLink = false;
      for (let j = i + 1; j < items.length; j++) {
        if (items[j].type === "subheader") break;
        if (items[j].type === "link") { hasLink = true; break; }
      }
      if (hasLink) out.push(it);
    } else {
      out.push(it);
    }
  }
  return out;
}

export function visibleNavStructure(role: Role, especialidade?: string | null): NavEntry[] {
  const out: NavEntry[] = [];
  for (const entry of NAV_STRUCTURE) {
    if (entry.type === "link") {
      if (isLinkVisible(role, entry, especialidade)) out.push(entry);
    } else {
      // Mantém subtítulos; filtra links por role/especialidade.
      const kept = entry.items.filter(
        (it) => it.type === "subheader" || isLinkVisible(role, it, especialidade),
      );
      const items = stripOrphanSubheaders(kept);
      // Só mostra o grupo se sobrou ao menos 1 link (não deixa grupo só com título).
      if (items.some((it) => it.type === "link")) out.push({ ...entry, items });
    }
  }
  return out;
}
