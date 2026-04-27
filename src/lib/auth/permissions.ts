export type Role =
  | "adm" | "socio" | "comercial" | "coordenador" | "assessor"
  | "videomaker" | "designer" | "editor" | "audiovisual_chefe";

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
  ],
  assessor: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
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
};

export function canAccess(role: Role | string, action: Action): boolean {
  const allowed = matrix[role as Role];
  if (!allowed) return false;
  return allowed.includes(action);
}
