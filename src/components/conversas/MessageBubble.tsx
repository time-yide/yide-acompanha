import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { formatHoraMsg, type MensagemMock } from "@/lib/conversas/mock-data";

interface Props {
  mensagem: MensagemMock;
}

/**
 * Bubble individual de mensagem. Visual estilo WhatsApp:
 * - Enviada (autor=comercial): à direita, verde mint
 * - Recebida (autor=lead): à esquerda, neutra
 * - Hora + status (✓ ✓✓ azul=lida) no canto inferior direito da bubble
 */
export function MessageBubble({ mensagem }: Props) {
  const eMinha = mensagem.autor === "comercial";

  return (
    <div className={`flex w-full ${eMinha ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[75%] rounded-lg px-3 py-1.5 shadow-sm ${
          eMinha
            ? "bg-emerald-500/15 dark:bg-emerald-700/30 rounded-tr-sm"
            : "bg-card border rounded-tl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-snug pr-14">
          {mensagem.texto}
        </p>
        <div className="float-right -mb-0.5 ml-2 mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>{formatHoraMsg(mensagem.timestamp)}</span>
          {eMinha && <StatusIcon status={mensagem.status} />}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: MensagemMock["status"] }) {
  if (status === "enviando") return <Clock className="h-3 w-3" />;
  if (status === "falhou") return <AlertCircle className="h-3 w-3 text-rose-500" />;
  if (status === "enviada") return <Check className="h-3 w-3" />;
  if (status === "entregue") return <CheckCheck className="h-3 w-3" />;
  // lida
  return <CheckCheck className="h-3 w-3 text-sky-500" />;
}
