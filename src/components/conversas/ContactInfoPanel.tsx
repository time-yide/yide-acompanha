import Link from "next/link";
import {
  Phone, Briefcase, User, Tag, Archive, BellOff, Trash2, ExternalLink,
} from "lucide-react";
import { Avatar } from "./Avatar";
import type { ConversaMock } from "@/lib/conversas/mock-data";

interface Props {
  conversa: ConversaMock;
}

/**
 * Painel direito: dados do contato + lead vinculado + atalhos.
 * Aparece só em viewport ≥ xl (1280px) pra não comer espaço do chat.
 */
export function ContactInfoPanel({ conversa }: Props) {
  return (
    <aside className="hidden h-full w-[300px] shrink-0 flex-col border-l bg-card xl:flex">
      <header className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Dados do contato</h3>
      </header>

      <div className="flex flex-col items-center gap-3 border-b px-4 py-6 text-center">
        <Avatar nome={conversa.contato_nome} avatarUrl={conversa.avatar_url} online={conversa.online} size="lg" />
        <div>
          <p className="font-medium">{conversa.contato_nome}</p>
          <p className="text-xs text-muted-foreground">{conversa.contato_telefone}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-full bg-muted p-2 hover:bg-muted/70"
            aria-label="Ligar"
            title="Em breve"
          >
            <Phone className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Info do atendimento */}
        <div className="space-y-3 border-b px-4 py-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Atendimento
          </h4>
          <Linha icon={User} label="Comercial" value={conversa.comercial_nome} />
          <Linha
            icon={Phone}
            label="Instância"
            value={conversa.instancia_nome}
          />
          <Linha
            icon={Tag}
            label="Canal"
            value={conversa.canal === "whatsapp" ? "WhatsApp" : "Instagram Direct"}
          />
        </div>

        {/* Lead vinculado */}
        <div className="space-y-3 border-b px-4 py-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Lead vinculado
          </h4>
          {conversa.lead_vinculado_id && conversa.lead_vinculado_nome ? (
            <Link
              href={`/onboarding/${conversa.lead_vinculado_id}`}
              className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span className="truncate font-medium">{conversa.lead_vinculado_nome}</span>
              </div>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum lead vinculado. Crie um a partir desta conversa.
            </p>
          )}
        </div>

        {/* Ações */}
        <div className="space-y-1 px-2 py-2 text-sm">
          <AcaoBotao icon={BellOff} label="Silenciar notificações" tom="muted" />
          <AcaoBotao icon={Archive} label="Arquivar conversa" tom="muted" />
          <AcaoBotao icon={Trash2} label="Apagar conversa" tom="destructive" />
        </div>
      </div>
    </aside>
  );
}

function Linha({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}

function AcaoBotao({
  icon: Icon, label, tom,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tom: "muted" | "destructive";
}) {
  const tomClasses = tom === "destructive"
    ? "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
    : "text-foreground hover:bg-muted";
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-xs ${tomClasses} disabled:cursor-not-allowed`}
      title="Em breve"
      disabled
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
