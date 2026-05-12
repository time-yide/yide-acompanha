import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MessageCircle, Sparkles, Inbox, QrCode, Send, Bot,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"];

export default async function ConversasPlaceholderPage() {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Em construção
        </div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" /> Conversas
        </h1>
        <p className="text-sm text-muted-foreground">
          Inbox unificada de WhatsApp e Instagram Direct dos seus comerciais.
          Múltiplos números de WhatsApp logados, filtro por comercial, integração
          com Gerador de Leads (botão WhatsApp do lead abre a conversa interna
          aqui — sem sair do sistema).
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FaseCard
          numero={1}
          titulo="Inbox WhatsApp + multi-número"
          status="planejado"
          tempo="~3-4 dias"
          icon={Inbox}
          itens={[
            "Cadastro de múltiplas instâncias (1 por número WhatsApp)",
            "Conexão via QR code (escaneia com celular do comercial)",
            "Recebe mensagens em tempo real via webhook",
            "Lista de conversas com filtro por instância + responsável",
            "Chat view: histórico, envio de mensagens, status (entregue/lida)",
            "Auto-vincula conversa ao lead se número bater",
            "Botão WhatsApp do Gerador de Leads abre conversa interna",
          ]}
        />
        <FaseCard
          numero={2}
          titulo="Multi-conta + atribuição"
          status="planejado"
          tempo="~2-3 dias"
          icon={Send}
          itens={[
            "Cada comercial conecta o WhatsApp dele",
            "Filtros por comercial, status, tag, lead vinculado",
            "Atribuição manual ou automática de conversa",
            "Notificações (push + sino) em mensagem nova",
            "Marcar como resolvida / arquivar",
          ]}
        />
        <FaseCard
          numero={3}
          titulo="Instagram Direct"
          status="planejado"
          tempo="~5 dias"
          icon={QrCode}
          itens={[
            "Conexão via Meta Graph API (mesmo token do Tráfego/Social)",
            "Inbox unificada: WhatsApp + DM Instagram",
            "Receber e responder DMs sem sair do sistema",
            "Auto-resposta configurável (boas-vindas, fora do horário)",
          ]}
        />
        <FaseCard
          numero={4}
          titulo="Templates + IA"
          status="planejado"
          tempo="~1 semana"
          icon={Bot}
          itens={[
            "Templates de resposta rápida",
            "IA Claude sugere resposta baseado no histórico",
            "Resumo automático da conversa",
            "Detecção de intenção (interessado, frio, hot lead)",
            "Encaminhamento automático pra próximo step (proposta, agenda)",
          ]}
        />
      </div>

      <Card className="p-4 space-y-2 border-amber-500/30 bg-amber-500/5">
        <h2 className="font-semibold text-sm">Stack escolhida</h2>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Provedor WhatsApp:</strong>{" "}
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            Evolution API
          </Badge>{" "}
          (open-source, hospedado em VPS próprio — ~$5/mês, ilimitado em números).
        </p>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Pré-requisitos pra Fase 1 funcionar:</strong>
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
          <li>VPS Linux com Docker (DigitalOcean / Hetzner / Contabo, $5-6/mês)</li>
          <li>Evolution API rodando via docker-compose</li>
          <li>HTTPS configurado (Caddy / Nginx + Let&apos;s Encrypt) pra webhook</li>
          <li>Ou: deploy via template no Railway ($5/mês, 1 clique)</li>
        </ul>
      </Card>

      <div className="text-center">
        <Link
          href="/gerador-leads"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Voltar pro Gerador de Leads
        </Link>
      </div>
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
