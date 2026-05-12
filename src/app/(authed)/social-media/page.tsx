import { notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, CheckCircle2, FileImage, Send, Sparkles } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ALLOWED_ROLES = [
  "adm", "socio", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];

export default async function SocialMediaPlaceholderPage() {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Em construção
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Social Media</h1>
        <p className="text-sm text-muted-foreground">
          Módulo de gestão de postagens nas redes sociais (estilo mLabs). Aqui vai centralizar
          calendário editorial, criação, agendamento, aprovação do cliente e publicação automática
          em Instagram, Facebook, LinkedIn e GMN.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FaseCard
          numero={1}
          titulo="Calendário + criação"
          status="planejado"
          tempo="~3 dias"
          icon={Calendar}
          itens={[
            "Calendário visual mensal/semanal por cliente",
            "Botão 'Novo post': upload de imagem/vídeo, legenda, hashtags, primeiro comentário",
            "Escolha de data/hora + redes (IG/FB)",
            "Status: rascunho → agendado → aprovado → publicado",
            "Filtros por cliente, status e rede",
          ]}
        />
        <FaseCard
          numero={2}
          titulo="Publicação automática (Meta)"
          status="planejado"
          tempo="~5 dias"
          icon={Send}
          itens={[
            "Cadastro Instagram + Facebook Page por cliente",
            "Cron a cada 5min publica posts agendados",
            "Suporte a Feed, Carrossel, Reels",
            "Stories (com permissão extra)",
            "Sync diário de stats (curtidas, comentários, alcance)",
          ]}
        />
        <FaseCard
          numero={3}
          titulo="Aprovação do cliente"
          status="planejado"
          tempo="~3 dias"
          icon={CheckCircle2}
          itens={[
            "Link público /aprovacao/[token] (sem login)",
            "Cliente vê preview e aprova ou pede ajuste",
            "Só publica depois de aprovado (configurável por cliente)",
            "Notificação por email/WhatsApp ao aprovar",
          ]}
        />
        <FaseCard
          numero={4}
          titulo="Multi-rede + extras"
          status="planejado"
          tempo="~1 semana"
          icon={FileImage}
          itens={[
            "LinkedIn Company Page",
            "Google Meu Negócio (posts)",
            "Biblioteca de templates",
            "Repostar / duplicar adaptando legenda por rede",
            "Inbox unificada (responder DMs/comentários)",
          ]}
        />
      </div>

      <Card className="p-4 space-y-2 border-amber-500/30 bg-amber-500/5">
        <h2 className="font-semibold text-sm">Pré-requisitos pra Fase 2 funcionar</h2>
        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
          <li>Cada Instagram do cliente precisa estar como <strong>Business/Creator</strong> e vinculado a uma <strong>Facebook Page</strong> dentro da sua BM.</li>
          <li>App criado no <Link href="https://developers.facebook.com" className="underline hover:text-foreground" target="_blank">developers.facebook.com</Link> com produto Marketing API + permissões <code>pages_manage_posts</code>, <code>instagram_content_publish</code>, <code>pages_read_engagement</code>.</li>
          <li>System User Token gerado na BM (mesmo que vai ser usado pro Tráfego Fase 2).</li>
        </ul>
      </Card>

      <div className="text-center">
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Voltar pro dashboard
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
