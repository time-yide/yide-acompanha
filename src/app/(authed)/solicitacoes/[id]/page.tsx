import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MessageCircle,
  CheckCircle2,
  User,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getRequestById } from "@/lib/portal-requests/queries";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  CATEGORIA_LABEL,
  STATUS_LABEL,
  type Status,
} from "@/lib/portal-requests/schema";
import { SolicitacaoResponderForm } from "@/components/solicitacoes/SolicitacaoResponderForm";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];

const STATUS_ICON: Record<Status, React.ReactNode> = {
  aberta: <Clock className="h-3.5 w-3.5" />,
  em_andamento: <AlertCircle className="h-3.5 w-3.5" />,
  concluida: <CheckCircle2 className="h-3.5 w-3.5" />,
  cancelada: <X className="h-3.5 w-3.5" />,
};

const STATUS_TONE: Record<Status, string> = {
  aberta: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  em_andamento: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  concluida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelada: "bg-muted text-muted-foreground",
};

function formatBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SolicitacaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const req = await getRequestById(id);
  if (!req) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/solicitacoes"
          className={buttonVariants({ variant: "ghost", size: "sm" }) + " -ml-2"}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar pra lista
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[req.status]}`}
          >
            {STATUS_ICON[req.status]}
            {STATUS_LABEL[req.status]}
          </span>
          <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {CATEGORIA_LABEL[req.categoria]}
          </span>
          {req.prioridade === "urgente" && (
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">
              Urgente
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{req.titulo}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            <Link href={`/clientes/${req.client_id}`} className="hover:text-foreground hover:underline">
              {req.cliente_nome}
            </Link>
            {req.created_by_nome && <span>· por {req.created_by_nome}</span>}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatBR(req.created_at)}
          </span>
        </div>
      </header>

      {/* Mensagem do cliente */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <MessageCircle className="h-3 w-3" />
          Mensagem do cliente
        </div>
        <p className="whitespace-pre-wrap text-sm">{req.descricao}</p>
      </Card>

      {/* Resposta já enviada (se tiver) */}
      {req.resposta && (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
            <CheckCircle2 className="h-3 w-3" />
            Resposta enviada
            {req.resolvido_por_nome && <span>· por {req.resolvido_por_nome}</span>}
          </div>
          <p className="whitespace-pre-wrap text-sm">{req.resposta}</p>
          {req.resolvido_em && (
            <p className="mt-2 text-[11px] text-muted-foreground">{formatBR(req.resolvido_em)}</p>
          )}
        </Card>
      )}

      {/* Form de resposta */}
      <SolicitacaoResponderForm
        requestId={req.id}
        currentStatus={req.status}
        currentResposta={req.resposta}
      />
    </div>
  );
}
