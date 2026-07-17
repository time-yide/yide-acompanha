"use client";

import { TipoPacoteBadge } from "./TipoPacoteBadge";
import { NaoSeAplicaCell } from "./cells/NaoSeAplicaCell";
import { CronoCell } from "./cells/CronoCell";
import { DesignCell } from "./cells/DesignCell";
import { TpgTpmCell } from "./cells/TpgTpmCell";
import { GmnCell } from "./cells/GmnCell";
import { GravacaoCell } from "./cells/GravacaoCell";
import { EdicaoCell } from "./cells/EdicaoCell";
import { ReuniaoCell } from "./cells/ReuniaoCell";
import { DriveCell } from "./cells/DriveCell";
import { isApplicable, type TipoPacote, type ColumnKey } from "@/lib/painel/pacote-matrix";
import type { ChecklistRow, ChecklistStepRow } from "@/lib/painel/queries";

interface Props {
  checklists: ChecklistRow[];
  userRole: string;
  userId: string;
}

const COLUMNS: Array<{ key: ColumnKey | "drive"; label: string }> = [
  { key: "crono", label: "Crono" },
  { key: "design", label: "Design" },
  { key: "tpg", label: "TPG" },
  { key: "tpm", label: "TPM" },
  { key: "gmn", label: "GMN" },
  { key: "camera", label: "Gravação" },
  { key: "edicao", label: "Edição" },
  { key: "reuniao", label: "Reunião" },
  { key: "drive", label: "Drive" },
];

function findStep(steps: ChecklistStepRow[], stepKey: string): ChecklistStepRow | undefined {
  return steps.find((s) => s.step_key === stepKey);
}

function isPrivileged(role: string): boolean {
  return ["socio", "adm", "coordenador"].includes(role);
}

export function PainelTable({ checklists, userRole, userId }: Props) {
  void userId;
  if (checklists.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhum cliente ativo nesse filtro/mês.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">
                Cliente
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="px-2 py-2 text-center text-[11px] font-medium text-muted-foreground"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checklists.map((row) => {
              const pacote = row.client_tipo_pacote as TipoPacote;
              // Assessor preenche o painel dos SEUS clientes (sobe cronograma,
              // marca TPG/TPM/GMN). A página já filtra o assessor pros próprios
              // clientes e a RLS reforça a posse, então liberar por role é seguro.
              const canEditCommon = isPrivileged(userRole) || userRole === "assessor";
              const cronoStep = findStep(row.steps, "cronograma");
              const edicaoStep = findStep(row.steps, "edicao");
              const reuniaoStep = findStep(row.steps, "reuniao");

              return (
                <tr key={row.client_id} className="border-t">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top">
                    <div className="font-medium">{row.client_nome}</div>
                    <TipoPacoteBadge pacote={pacote} numeroUnidades={row.client_numero_unidades} />
                    {!row.client_tipo_pacote_revisado && (
                      <p className="mt-0.5 text-[9px] text-amber-600 dark:text-amber-400">
                        ⚠ Tipo inferido, revise
                      </p>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center">
                    {isApplicable(pacote, "crono") ? (
                      <CronoCell
                        status={cronoStep?.status ?? "pendente"}
                        cronogramaUrl={row.cronograma_url ?? row.client_link_estrategia}
                        pacotePost={row.pacote_post}
                        pacoteVideo={row.pacote_video}
                        clientId={row.client_id}
                        clientNome={row.client_nome}
                        mesReferencia={row.mes_referencia}
                        canEdit={canEditCommon}
                      />
                    ) : (
                      <NaoSeAplicaCell />
                    )}
                  </td>

                  <td className="px-2 py-2 text-center">
                    {isApplicable(pacote, "design") ? (
                      <DesignCell
                        designTaskId={row.design_task_id}
                        designTaskStatus={row.designTaskStatus}
                      />
                    ) : (
                      <NaoSeAplicaCell />
                    )}
                  </td>

                  <td className="px-2 py-2 text-center">
                    {isApplicable(pacote, "tpg") ? (
                      <TpgTpmCell
                        checklistId={row.id}
                        field="tpg_ativo"
                        ativo={row.tpg_ativo}
                        valorAcordado={row.client_valor_trafego_google}
                        canEdit={canEditCommon}
                      />
                    ) : (
                      <NaoSeAplicaCell />
                    )}
                  </td>

                  <td className="px-2 py-2 text-center">
                    {isApplicable(pacote, "tpm") ? (
                      <TpgTpmCell
                        checklistId={row.id}
                        field="tpm_ativo"
                        ativo={row.tpm_ativo}
                        valorAcordado={row.client_valor_trafego_meta}
                        canEdit={canEditCommon}
                      />
                    ) : (
                      <NaoSeAplicaCell />
                    )}
                  </td>

                  <td className="px-2 py-2 text-center">
                    {isApplicable(pacote, "gmn") ? (
                      <GmnCell
                        checklistId={row.id}
                        clientNome={row.client_nome}
                        mesReferencia={row.mes_referencia}
                        comentarios={row.gmn_comentarios}
                        avaliacoes={row.gmn_avaliacoes}
                        notaMedia={row.gmn_nota_media}
                        observacoes={row.gmn_observacoes}
                        otimizado={row.gmn_otimizado}
                        canEdit={canEditCommon}
                      />
                    ) : (
                      <NaoSeAplicaCell />
                    )}
                  </td>

                  <td className="px-2 py-2 text-center">
                    {isApplicable(pacote, "camera") ? (
                      <GravacaoCell count={row.gravacao_count} />
                    ) : (
                      <NaoSeAplicaCell />
                    )}
                  </td>

                  <td className="px-2 py-2 text-center">
                    {isApplicable(pacote, "edicao") ? (
                      <EdicaoCell status={edicaoStep?.status ?? "pendente"} />
                    ) : (
                      <NaoSeAplicaCell />
                    )}
                  </td>

                  <td className="px-2 py-2 text-center">
                    {isApplicable(pacote, "reuniao") ? (
                      <ReuniaoCell status={reuniaoStep?.status ?? "pendente"} />
                    ) : (
                      <NaoSeAplicaCell />
                    )}
                  </td>

                  <td className="px-2 py-2 text-center">
                    <DriveCell driveUrl={row.client_drive_url} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
