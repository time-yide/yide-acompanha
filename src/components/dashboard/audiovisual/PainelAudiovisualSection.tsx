import Link from "next/link";
import { Film, CheckCircle2, Wrench, AlertCircle } from "lucide-react";
import { getPainelAudiovisual, type CapturaPainelRow, type StatusAtual } from "@/lib/dashboard/audiovisual-painel";

function formatDateBR(iso: string): string {
  const datePart = iso.length === 10 ? iso : iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function StatusBadge({ status, detalhe }: { status: StatusAtual; detalhe: string | null }) {
  const config: Record<StatusAtual, { className: string; icon: React.ReactNode; label: string }> = {
    "Concluída": {
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Concluída",
    },
    "Em edição": {
      className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      icon: <Wrench className="h-3 w-3" />,
      label: detalhe ? `Em edição: ${detalhe}` : "Em edição",
    },
    "Aguardando delegação": {
      className: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
      icon: <AlertCircle className="h-3 w-3" />,
      label: "Aguardando delegação",
    },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function rowHref(row: CapturaPainelRow): string {
  return row.taskId ? `/tarefas/${row.taskId}` : "/audiovisual";
}

export async function PainelAudiovisualSection() {
  const rows = await getPainelAudiovisual();

  const totalCount = rows.length;
  const totalVideos = rows.reduce((s, r) => s + r.qtd_videos, 0);
  const totalFotos = rows.reduce((s, r) => s + r.qtd_fotos, 0);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80">
          <Film className="h-4 w-4" /> Audiovisual — Últimos 3 dias
        </h2>
        {totalCount > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {totalCount} captação{totalCount === 1 ? "" : "ões"} · {totalVideos} vídeo{totalVideos === 1 ? "" : "s"} · {totalFotos} foto{totalFotos === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {totalCount === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Nenhuma captação nos últimos 3 dias.
        </p>
      ) : (
        <>
          {/* Mobile: lista de cards */}
          <div className="space-y-2 md:hidden">
            {rows.map((r) => (
              <Link key={r.id} href={rowHref(r)} className="block" prefetch={false}>
                <div className="space-y-1 rounded-lg border bg-card p-3 hover:bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">{formatDateBR(r.data_captacao)}</span>
                    <StatusBadge status={r.statusAtual} detalhe={r.statusDetalhe} />
                  </div>
                  <p className="truncate text-sm font-medium">{r.cliente_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.videomaker_nome} · {r.qtd_videos}v · {r.qtd_fotos}f
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Data</th>
                  <th className="px-3 py-2 text-left font-medium">Cliente</th>
                  <th className="px-3 py-2 text-left font-medium">Responsável</th>
                  <th className="px-3 py-2 text-left font-medium">Quantidade</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const href = rowHref(r);
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="p-0">
                        <Link href={href} className="block px-3 py-2 tabular-nums" prefetch={false}>{formatDateBR(r.data_captacao)}</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-3 py-2" prefetch={false}>{r.cliente_nome}</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-3 py-2 text-muted-foreground" prefetch={false}>{r.videomaker_nome}</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-3 py-2 text-xs text-muted-foreground" prefetch={false}>{r.qtd_videos}v · {r.qtd_fotos}f</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-3 py-2" prefetch={false}><StatusBadge status={r.statusAtual} detalhe={r.statusDetalhe} /></Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
