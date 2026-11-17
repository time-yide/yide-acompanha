import { Bot, Tag, ExternalLink } from "lucide-react";
import { Avatar } from "./Avatar";
import type { WppConversation } from "@/lib/conversas/types";

interface Props {
  conversa: WppConversation;
}

export function ContactInfoPanel({ conversa }: Props) {
  return (
    <aside className="hidden h-full w-[300px] shrink-0 flex-col border-l bg-card xl:flex">
      <header className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Dados do contato</h3>
      </header>

      <div className="flex flex-col items-center gap-3 border-b px-4 py-6 text-center">
        <Avatar nome={conversa.contato_nome || conversa.contato_telefone} avatarUrl={conversa.avatar_url} size="lg" />
        <div>
          <p className="font-medium">{conversa.contato_nome || conversa.contato_telefone}</p>
          <p className="text-xs text-muted-foreground">{conversa.contato_telefone}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3 border-b px-4 py-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Atendimento
          </h4>
          <Linha icon={Tag} label="Canal" value="WhatsApp (API da agência)" />
          <Linha icon={Bot} label="IA" value={conversa.ai_ativa ? "Ativa" : "Pausada"} />
        </div>

        {conversa.lyide_url && (
          <div className="px-4 py-4">
            <a
              href={conversa.lyide_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs hover:bg-muted/50"
            >
              <span className="font-medium">Abrir conversa no Lyide</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
            </a>
          </div>
        )}
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
