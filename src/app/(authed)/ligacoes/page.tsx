import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Phone, Sparkles, BarChart3, Headphones, Brain, Zap,
  PhoneCall, PhoneOff, Clock, Users,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"];

export default async function LigacoesPlaceholderPage() {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Em construção
        </div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Phone className="h-6 w-6 text-primary" /> Ligações
        </h1>
      </header>

      {/* Mock dashboard preview */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preview de como vai ficar
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 opacity-60">
          <KpiPreview icon={PhoneCall} label="Total Chamadas" value="—" tone="border-blue-500/30 bg-blue-500/5" />
          <KpiPreview icon={Phone} label="Atendidas" value="—" tone="border-emerald-500/30 bg-emerald-500/5" />
          <KpiPreview icon={PhoneOff} label="Perdidas" value="—" tone="border-rose-500/30 bg-rose-500/5" />
          <KpiPreview icon={Clock} label="Duração média" value="—" tone="border-violet-500/30 bg-violet-500/5" />
          <KpiPreview icon={Users} label="Clientes únicos" value="—" tone="border-amber-500/30 bg-amber-500/5" />
        </div>
        <Card className="p-6 text-center text-xs text-muted-foreground border-dashed">
          📊 Gráfico de volume + status das chamadas (em construção)
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FaseCard
          numero={1}
          titulo="Dashboard + integração PABX"
          status="planejado"
          tempo="~5-7 dias"
          icon={BarChart3}
          itens={[
            "KPIs: total, atendidas, perdidas, hora pico, ramal mais ativo",
            "Gráfico de volume por dia/semana/mês",
            "Distribuição de status (donut)",
            "Lista detalhada de chamadas",
            "Filtros: data, ramal, status, cliente",
            "Webhook recebe call events do seu PABX",
          ]}
        />
        <FaseCard
          numero={2}
          titulo="Ligar pelo sistema (click-to-call)"
          status="planejado"
          tempo="~3-5 dias"
          icon={Headphones}
          itens={[
            "Botão 'Ligar' em qualquer cliente/lead",
            "PABX faz a chamada e conecta com o ramal do comercial",
            "Modal de notas durante a ligação",
            "Vincula automaticamente ao lead/cliente",
          ]}
        />
        <FaseCard
          numero={3}
          titulo="Gravações + transcrição IA"
          status="planejado"
          tempo="~5 dias"
          icon={Brain}
          itens={[
            "Player de gravação na página da ligação",
            "Transcrição automática (Whisper / Gemini)",
            "Resumo por IA — pontos principais, próximos passos",
            "Tags automáticas (interessado, frio, follow-up, fechou)",
          ]}
        />
        <FaseCard
          numero={4}
          titulo="Automação + relatórios"
          status="planejado"
          tempo="~1 semana"
          icon={Zap}
          itens={[
            "Auto-criação de tarefa após ligação ('Mandar proposta')",
            "Relatório por comercial (chamadas/dia, taxa de conversão)",
            "Comparativo entre comerciais",
            "Meta de chamadas/dia + alerta",
            "Integração com CRM (vínculo automático lead→ligação)",
          ]}
        />
      </div>

      <Card className="p-4 space-y-3 border-amber-500/30 bg-amber-500/5">
        <h2 className="font-semibold text-sm">Decisão pendente: qual PABX você usa?</h2>
        <p className="text-xs text-muted-foreground">
          Pra eu construir a integração real, preciso saber qual telefonia você usa
          ou pretende usar:
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
          <div className="rounded-md border bg-card p-3 space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[9px]">Recomendo</Badge>
              iFix (que você já usa?)
            </p>
            <p className="text-muted-foreground">
              Se já tem conta, integração via API/webhook. Mais simples.
            </p>
          </div>
          <div className="rounded-md border bg-card p-3 space-y-1">
            <p className="font-semibold">Twilio</p>
            <p className="text-muted-foreground">
              Cloud, pay-per-use. Funciona em qualquer país, fácil de integrar.
            </p>
          </div>
          <div className="rounded-md border bg-card p-3 space-y-1">
            <p className="font-semibold">3CX</p>
            <p className="text-muted-foreground">
              PABX virtual, $-$$$. Tem API REST.
            </p>
          </div>
          <div className="rounded-md border bg-card p-3 space-y-1">
            <p className="font-semibold">TotalVoice / Vonage / outro</p>
            <p className="text-muted-foreground">
              Funciona — me passa qual e eu integro.
            </p>
          </div>
        </div>
      </Card>

      <div className="text-center">
        <Link
          href="/conversas"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Voltar pra Conversas
        </Link>
      </div>
    </div>
  );
}

function KpiPreview({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-1 ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[9px] text-muted-foreground">aguardando integração</p>
    </div>
  );
}

function FaseCard({
  numero, titulo, status, tempo, icon: Icon, itens,
}: {
  numero: number;
  titulo: string;
  status: "planejado" | "em_andamento" | "pronto";
  tempo: string;
  icon: React.ComponentType<{ className?: string }>;
  itens: string[];
}) {
  const statusBadge = {
    planejado: { label: "Planejado", className: "border-muted-foreground/30 text-muted-foreground" },
    em_andamento: { label: "Em construção", className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    pronto: { label: "Pronto", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  }[status];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-muted text-xs font-bold">
            {numero}
          </span>
          <h3 className="font-semibold">{titulo}</h3>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <Badge variant="outline" className={statusBadge.className}>{statusBadge.label}</Badge>
        <span className="text-muted-foreground">{tempo}</span>
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
        {itens.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </Card>
  );
}
