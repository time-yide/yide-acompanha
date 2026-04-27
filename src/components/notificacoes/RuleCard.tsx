import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RecipientsSelector } from "./RecipientsSelector";
import { updateRuleAction } from "@/lib/notificacoes/rule-actions";

const eventLabels: Record<string, string> = {
  task_assigned: "Tarefa atribuída a mim",
  task_completed: "Tarefa concluída",
  kanban_moved: "Card kanban movido",
  prospeccao_agendada: "Prospecção agendada",
  deal_fechado: "Deal fechado",
  mes_aguardando_aprovacao: "Mês aguardando aprovação",
  mes_aprovado: "Mês aprovado",
  cliente_perto_churn: "Cliente perto do churn",
  task_prazo_amanha: "Tarefa vence amanhã",
  task_overdue: "Tarefa atrasada",
  evento_calendario_hoje: "Evento do calendário hoje",
  marco_zero_24h: "Marco zero amanhã",
  aniversario_socio_cliente: "Aniversário sócio cliente",
  aniversario_colaborador: "Aniversário colaborador",
  renovacao_contrato: "Renovação de contrato",
  satisfacao_pendente: "Satisfação pendente",
};

const ROLE_OPTIONS = [
  { value: "socio", label: "Sócio" },
  { value: "adm", label: "ADM" },
  { value: "comercial", label: "Comercial" },
  { value: "coordenador", label: "Coordenador" },
  { value: "assessor", label: "Assessor" },
  { value: "audiovisual_chefe", label: "Audiovisual Chefe" },
  { value: "videomaker", label: "Videomaker" },
  { value: "designer", label: "Designer" },
  { value: "editor", label: "Editor" },
];

interface Rule {
  evento_tipo: string;
  ativo: boolean;
  mandatory: boolean;
  email_default: boolean;
  permite_destinatarios_extras: boolean;
  default_roles: string[];
  default_user_ids: string[];
}

interface Profile { id: string; nome: string; }

export function RuleCard({ rule, profiles }: { rule: Rule; profiles: Profile[] }) {
  return (
    <Card className="p-4 space-y-3">
      <form action={async (fd: FormData) => { await updateRuleAction(fd); }} className="space-y-3">
        <input type="hidden" name="evento_tipo" value={rule.evento_tipo} />

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{eventLabels[rule.evento_tipo] ?? rule.evento_tipo}</h3>
          <div className="flex items-center gap-2">
            <Label htmlFor={`ativo-${rule.evento_tipo}`} className="text-xs">Ativo</Label>
            <Switch id={`ativo-${rule.evento_tipo}`} name="ativo" defaultChecked={rule.ativo} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Switch id={`mandatory-${rule.evento_tipo}`} name="mandatory" defaultChecked={rule.mandatory} />
            <Label htmlFor={`mandatory-${rule.evento_tipo}`}>Obrigatório</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={`email-${rule.evento_tipo}`} name="email_default" defaultChecked={rule.email_default} />
            <Label htmlFor={`email-${rule.evento_tipo}`}>Email padrão</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={`extras-${rule.evento_tipo}`} name="permite_destinatarios_extras" defaultChecked={rule.permite_destinatarios_extras} />
            <Label htmlFor={`extras-${rule.evento_tipo}`}>Permite extras</Label>
          </div>
        </div>

        <RecipientsSelector
          initialRoles={rule.default_roles}
          initialUserIds={rule.default_user_ids}
          roleOptions={ROLE_OPTIONS}
          profileOptions={profiles}
        />

        <Button type="submit" size="sm" variant="outline">Salvar</Button>
      </form>
    </Card>
  );
}
