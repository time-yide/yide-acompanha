import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getProspectDetail, getLeadAttempts } from "@/lib/prospeccao/queries";
import { ProspectDetailHeader } from "@/components/prospeccao/ProspectDetailHeader";
import { LeadAttemptsTimeline } from "@/components/prospeccao/LeadAttemptsTimeline";
import { AddAttemptForm } from "@/components/prospeccao/AddAttemptForm";
import { AgendarReuniaoButton } from "@/components/prospeccao/AgendarReuniaoButton";
import { MarcarPerdidoButton } from "@/components/prospeccao/MarcarPerdidoButton";

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  const prospect = await getProspectDetail(id);
  if (!prospect) notFound();

  if (user.role === "comercial" && prospect.comercial_id !== user.id) {
    notFound();
  }

  const attempts = await getLeadAttempts(id);

  const isPerdido = prospect.motivo_perdido !== null;

  return (
    <div className="space-y-5">
      <ProspectDetailHeader prospect={prospect} />

      {!isPerdido && prospect.stage !== "ativo" && (
        <div className="flex flex-wrap gap-2">
          <AgendarReuniaoButton leadId={prospect.id} />
          <MarcarPerdidoButton leadId={prospect.id} />
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Histórico de contato</h3>
          {!isPerdido && <AddAttemptForm leadId={prospect.id} />}
        </div>
        <LeadAttemptsTimeline attempts={attempts} />
      </section>
    </div>
  );
}
