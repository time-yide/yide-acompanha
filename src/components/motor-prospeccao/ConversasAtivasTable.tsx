import Link from "next/link";
import type { ConversaAtiva } from "@/lib/motor-prospeccao/dashboard-queries";

interface Props {
  conversas: ConversaAtiva[];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ConversasAtivasTable({ conversas }: Props) {
  if (conversas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma conversa ativa.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2">Lead</th>
            <th className="pb-2">Nicho</th>
            <th className="pb-2">Última msg</th>
            <th className="pb-2">Há</th>
          </tr>
        </thead>
        <tbody>
          {conversas.map((c) => (
            <tr key={c.id} className="border-b hover:bg-muted/50">
              <td className="py-2">
                <Link href="/conversas" className="text-primary hover:underline">
                  {c.contato_nome}
                </Link>
              </td>
              <td className="py-2 text-muted-foreground">{c.lead_categoria ?? "-"}</td>
              <td className="py-2 max-w-[200px] truncate">{c.ultimo_texto ?? "-"}</td>
              <td className="py-2 text-muted-foreground">{timeAgo(c.ultima_msg_em)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
