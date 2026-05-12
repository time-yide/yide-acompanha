import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Settings, Phone, MessageCircle } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listColaboradoresAtivos, getOrganizationId } from "@/lib/ligacoes/queries";
import { listInstancias } from "@/lib/ligacoes/instancia-actions";
import { InstanciasList } from "@/components/ligacoes/InstanciasList";
import { Card } from "@/components/ui/card";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador"];
const ROLES_QUE_GERENCIAM = ["adm", "socio", "comercial", "coordenador"];

export default async function LigacoesConfigPage() {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const [instancias, colaboradores] = await Promise.all([
    listInstancias(orgId),
    listColaboradoresAtivos(orgId),
  ]);

  const canManage = ROLES_QUE_GERENCIAM.includes(user.role);

  const total = instancias.length;
  const totalTelefone = instancias.filter((i) => i.tipo === "telefone").length;
  const totalWA = instancias.filter((i) => i.tipo === "whatsapp").length;
  const conectados = instancias.filter((i) => i.status === "conectado").length;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link
          href="/ligacoes"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar pro dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Configurações de Ligações
        </h1>
      </div>

      {/* KPIs simples */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiMini label="Total" value={total} />
        <KpiMini label="Telefone" value={totalTelefone} icon={Phone} tone="text-blue-500" />
        <KpiMini label="WhatsApp" value={totalWA} icon={MessageCircle} tone="text-emerald-500" />
        <KpiMini label="Conectados" value={conectados} tone="text-emerald-500" />
      </div>

      {/* Lista de instâncias */}
      <InstanciasList instancias={instancias} colaboradores={colaboradores} canManage={canManage} />
    </div>
  );
}

function KpiMini({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <Card className="p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && <Icon className={`h-3 w-3 ${tone ?? "text-muted-foreground"}`} />}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
    </Card>
  );
}
