import { MessageCircle, Lock } from "lucide-react";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import type { ConversaMock, MensagemMock } from "@/lib/conversas/mock-data";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

interface Props {
  conversa: ConversaMock | null;
}

/** Agrupa mensagens por dia (YYYY-MM-DD) pra mostrar separadores tipo WhatsApp. */
function agruparPorDia(mensagens: MensagemMock[]): Array<{ dia: string; rotulo: string; itens: MensagemMock[] }> {
  const grupos = new Map<string, MensagemMock[]>();
  for (const m of mensagens) {
    const dia = m.timestamp.slice(0, 10);
    const cur = grupos.get(dia) ?? [];
    cur.push(m);
    grupos.set(dia, cur);
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, itens]) => {
      let rotulo: string;
      if (dia === hoje) rotulo = "Hoje";
      else if (dia === ontem) rotulo = "Ontem";
      else {
        const d = new Date(`${dia}T12:00:00`);
        const diffDias = (Date.now() - d.getTime()) / 86400000;
        rotulo = diffDias < 7
          ? d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, weekday: "long" })
          : d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "long", year: "numeric" });
      }
      return { dia, rotulo, itens };
    });
}

/** Wallpaper sutil dark/light pra remeter ao WhatsApp sem ser igualzinho. */
const WALLPAPER_CLASSES =
  "bg-[radial-gradient(circle_at_top_left,theme(colors.emerald.500/0.04),transparent_40%),radial-gradient(circle_at_bottom_right,theme(colors.teal.500/0.04),transparent_40%)]";

export function ChatView({ conversa }: Props) {
  if (!conversa) {
    return (
      <div className={`flex h-full flex-1 flex-col items-center justify-center gap-4 ${WALLPAPER_CLASSES} bg-muted/20`}>
        <div className="rounded-full bg-emerald-500/10 p-8">
          <MessageCircle className="h-16 w-16 text-emerald-500/60" />
        </div>
        <div className="max-w-md text-center space-y-2 px-6">
          <h2 className="text-xl font-light tracking-tight">Conversas Yide</h2>
          <p className="text-sm text-muted-foreground">
            Inbox unificada de WhatsApp e Instagram dos comerciais. Selecione uma
            conversa à esquerda pra começar.
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          As mensagens trafegam pela Evolution API hospedada na sua VPS.
        </p>
      </div>
    );
  }

  const grupos = agruparPorDia(conversa.mensagens);

  return (
    <div className={`flex h-full flex-1 flex-col ${WALLPAPER_CLASSES}`}>
      <ChatHeader conversa={conversa} />

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-6">
        {grupos.map((g) => (
          <div key={g.dia} className="space-y-2">
            <div className="flex justify-center">
              <span className="rounded-full bg-card/80 backdrop-blur-sm px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground shadow-sm">
                {g.rotulo}
              </span>
            </div>
            {g.itens.map((m) => (
              <MessageBubble key={m.id} mensagem={m} />
            ))}
          </div>
        ))}
      </div>

      <ChatInput />
    </div>
  );
}
