export type Role =
  | "adm" | "socio" | "comercial" | "coordenador" | "assessor"
  | "videomaker" | "designer" | "editor" | "audiovisual_chefe"
  | "assessor_ecommerce" | "assistente_ecommerce"
  | "programacao" | "fast_midia";

/**
 * Label visível no UI pra cada role. O enum `app_role` no banco mantém
 * `socio` (decisão Yasmin - renomear quebraria RLS/FKs), mas no UI
 * sócio aparece como "Coordenador". `coordenador` antigo virou "legado".
 */
export const ROLE_LABELS: Record<string, string> = {
  adm: "Administrativo",
  socio: "Coordenador",
  comercial: "Comercial",
  coordenador: "Coordenador (legado)",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Coordenador audiovisual",
  assessor_ecommerce: "Assessor de e-commerce",
  assistente_ecommerce: "Assistente de e-commerce",
  programacao: "Programação",
  fast_midia: "Fast Mídia",
};

/** Devolve o label visível de um role. Faz fallback pro próprio valor. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * Roles de "gestão operacional": gerenciam QUALQUER tarefa (editar, mover
 * status, concluir, aprovar/pedir ajustes) mesmo sem ser criador ou atribuído.
 * Adm/sócio + coordenador + assessor + audiovisual_chefe — assessor e coord
 * mexem nos cards um do outro pra coordenar entregas. Espelha a RLS de UPDATE
 * de tasks. NOTA: delete continua restrito (ver isPrivileged nos call-sites).
 *
 * Fonte única pra UI (páginas de tarefa) e server actions não divergirem — a
 * divergência UI (isPrivileged, sem assessor) vs server (com assessor) era o
 * que travava o assessor de editar tarefa do coordenador audiovisual.
 */
export function canManageAnyTask(user: { role: string }): boolean {
  return (
    user.role === "adm" ||
    user.role === "socio" ||
    user.role === "coordenador" ||
    user.role === "assessor" ||
    user.role === "audiovisual_chefe"
  );
}

export type Action =
  // Gestão de usuários
  | "manage:users"
  | "edit:commission_percent"
  | "edit:colaboradores"
  // Visualizações
  | "view:all_clients"
  | "view:client_money_all"
  | "view:financial_consolidated"
  | "view:own_commission"
  | "view:other_commissions"
  // Onboarding / Comercial
  | "access:prospeccao"
  | "kanban:move_prospeccao_to_comercial"
  | "kanban:move_comercial_to_contrato"
  | "kanban:move_contrato_to_marco_zero"
  | "kanban:move_marco_zero_to_ativo"
  // Aprovações
  | "approve:monthly_closing"
  // Tarefas e calendário
  | "create:tasks"
  | "create:calendar_event"
  | "customize:notification_recipients"
  // Satisfação
  | "feed:satisfaction"
  // Tráfego
  | "manage:trafego_relatorios"
  // Sistema
  | "system:support";

const matrix: Record<Role, Action[]> = {
  socio: [
    "manage:users", "edit:commission_percent", "edit:colaboradores",
    "view:all_clients", "view:client_money_all", "view:financial_consolidated",
    "view:own_commission", "view:other_commissions",
    "access:prospeccao",
    "kanban:move_prospeccao_to_comercial", "kanban:move_comercial_to_contrato",
    "kanban:move_contrato_to_marco_zero", "kanban:move_marco_zero_to_ativo",
    "approve:monthly_closing",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
    "manage:trafego_relatorios",
  ],
  adm: [
    "manage:users", "edit:colaboradores",
    "view:all_clients", "view:client_money_all", "view:financial_consolidated",
    "view:own_commission", "view:other_commissions",
    "access:prospeccao",
    "kanban:move_prospeccao_to_comercial", "kanban:move_comercial_to_contrato",
    "kanban:move_contrato_to_marco_zero", "kanban:move_marco_zero_to_ativo",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "system:support",
    "manage:trafego_relatorios",
  ],
  comercial: [
    "view:all_clients",
    "view:own_commission",
    "access:prospeccao",
    "kanban:move_prospeccao_to_comercial", "kanban:move_comercial_to_contrato",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
  ],
  coordenador: [
    "view:all_clients",
    "view:own_commission",
    "kanban:move_marco_zero_to_ativo",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
    "manage:trafego_relatorios",
  ],
  assessor: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
    "manage:trafego_relatorios",
  ],
  videomaker: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  designer: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  editor: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  audiovisual_chefe: [
    "view:all_clients",
    "view:client_money_all",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  // Conjunto mínimo intencional: assessor de e-commerce não participa do fluxo
  // de satisfação (sem feed:satisfaction) nem de aprovações/financeiro.
  assessor_ecommerce: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
  ],
  // Assistente de e-commerce: mesmos acessos do assessor de e-commerce, mas é
  // um cargo separado. Também não ganha comissão (fica de fora do calculator).
  assistente_ecommerce: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
  ],
  // Programação: cargo técnico (CRM/integrações/analytics — módulos futuros).
  // Por ora SEM acessos: nenhuma permissão e nenhum item de menu (ver
  // isLinkVisible em nav-config). Não ganha comissão (fora do calculator).
  programacao: [],
  // Fast Mídia: responsável pelos stories dos clientes E exerce a função de
  // videomaker (aparece na equipe audiovisual do coordenador, é delegável a
  // gravações, entra no fluxo de satisfação). Mesmo conjunto de permissões do
  // videomaker. Não ganha comissão (fica de fora do calculator).
  fast_midia: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
};

export function canAccess(role: Role | string, action: Action): boolean {
  const allowed = matrix[role as Role];
  if (!allowed) return false;
  return allowed.includes(action);
}
