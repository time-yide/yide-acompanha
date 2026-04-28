import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { StatusCell } from "./StatusCell";
import { StepModal } from "./StepModal";
import type { ChecklistRow } from "@/lib/painel/queries";
import type { StepKey, StepStatus } from "@/lib/painel/deadlines";

interface Props {
  checklists: ChecklistRow[];
  userRole: string;
  userId: string;
}

const STEP_COLUMNS: Array<{ key: StepKey; label: string }> = [
  { key: "cronograma", label: "Crono" },
  { key: "design", label: "Design" },
  { key: "tpg", label: "TPG" },
  { key: "tpm", label: "TPM" },
  { key: "gmn_post", label: "GM" },
  { key: "camera", label: "Câmera" },
  { key: "mobile", label: "Mobile" },
  { key: "edicao", label: "Edição" },
  { key: "reuniao", label: "Reunião" },
  { key: "postagem", label: "Postag." },
];

function formatBRL(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function PainelTable({ checklists, userRole, userId }: Props) {
  if (checklists.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum cliente com checklist neste mês.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/40 z-10">Cliente</th>
            <th className="px-3 py-2 text-center font-medium">Pacote/Postados</th>
            {STEP_COLUMNS.map((col) => (
              <th key={col.key} className="px-2 py-2 text-center font-medium">{col.label}</th>
            ))}
            <th className="px-3 py-2 text-right font-medium">R$</th>
            <th className="px-3 py-2 text-center font-medium">Drive</th>
          </tr>
        </thead>
        <tbody>
          {checklists.map((cl) => (
            <tr key={cl.client_id} className="border-t hover:bg-muted/20">
              <td className="px-3 py-2 sticky left-0 bg-card z-10">
                <Link href={`/clientes/${cl.client_id}`} className="font-medium hover:underline">
                  {cl.client_nome}
                </Link>
              </td>
              <td className="px-3 py-2 text-center text-xs tabular-nums">
                {cl.pacote_post ?? "—"} / {cl.quantidade_postada ?? "—"}
              </td>
              {STEP_COLUMNS.map((col) => {
                const step = cl.steps.find((s) => s.step_key === col.key);
                const status: StepStatus | null = step?.status ?? null;
                return (
                  <td key={col.key} className="px-2 py-2 text-center">
                    {step ? (
                      <StepModal step={step} clientNome={cl.client_nome} userRole={userRole} userId={userId} clientId={cl.client_id}>
                        <StatusCell status={status} />
                      </StepModal>
                    ) : (
                      <StatusCell status={null} />
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right tabular-nums">{formatBRL(cl.valor_trafego_mes)}</td>
              <td className="px-3 py-2 text-center">
                {cl.client_drive_url ? (
                  <a
                    href={cl.client_drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-primary hover:underline"
                    title="Abrir Drive"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
