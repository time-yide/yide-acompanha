import {
  LayoutGrid, Users, Briefcase, KanbanSquare, ListChecks,
  DollarSign, Smile, Calendar, UserCog, ClipboardList, MessageSquare,
  TrendingUp, Video, Trash2, MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/permissions";

export type NavBadgeKey = "recados" | "escritorio";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  roles: "all" | readonly Role[];
  badgeKey: NavBadgeKey | null;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", icon: LayoutGrid, label: "Dashboard", roles: "all", badgeKey: null },
  { href: "/clientes", icon: Users, label: "Clientes", roles: "all", badgeKey: null },
  { href: "/onboarding", icon: KanbanSquare, label: "Onboarding", roles: "all", badgeKey: null },
  { href: "/prospeccao", icon: Briefcase, label: "Prospecção", roles: ["adm", "socio", "comercial"], badgeKey: null },
  { href: "/tarefas", icon: ListChecks, label: "Tarefas", roles: "all", badgeKey: null },
  { href: "/audiovisual", icon: Video, label: "Audiovisual", roles: ["adm", "socio", "coordenador", "assessor", "videomaker", "audiovisual_chefe"], badgeKey: null },
  { href: "/recados", icon: MessageSquare, label: "Recados", roles: "all", badgeKey: "recados" },
  { href: "/escritorio", icon: MessagesSquare, label: "Escritório Virtual", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"], badgeKey: "escritorio" },
  { href: "/painel", icon: ClipboardList, label: "Painel mensal", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"], badgeKey: null },
  { href: "/comissoes", icon: DollarSign, label: "Comissões", roles: "all", badgeKey: null },
  { href: "/financeiro", icon: TrendingUp, label: "Financeiro", roles: ["socio", "adm"], badgeKey: null },
  { href: "/satisfacao", icon: Smile, label: "Satisfação", roles: "all", badgeKey: null },
  { href: "/calendario", icon: Calendar, label: "Calendário Interno", roles: "all", badgeKey: null },
  { href: "/colaboradores", icon: UserCog, label: "Colaboradores", roles: "all", badgeKey: null },
  { href: "/lixeira", icon: Trash2, label: "Lixeira", roles: ["adm", "socio", "coordenador", "assessor"], badgeKey: null },
];

export function visibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => item.roles === "all" || (Array.isArray(item.roles) && item.roles.includes(role)),
  );
}
