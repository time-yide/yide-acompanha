import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Loader2 } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getTodayDate } from "@/lib/datetime/timezone";
import {
  podeConduzirCheck, podeVerCheckDoAssessor, podeVerModuloCheck, resolverSemana, rotuloSemana, STATUS_LABEL,
} from "@/lib/check/core";
import { getCheckDetalhe } from "@/lib/check/queries";
import { GravadorReuniao } from "@/components/reunioes/GravadorReuniao";
import {
  AutoRefresh, CheckinEditor, ChecklistAssessor, CheckoutPanel, IniciarCheckButton, ResultadoSemana,
} from "@/components/check/CheckPanels";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function CheckAssessorPage({
  params,
  searchParams,
}: {
  params: Promise<{ assessorId: string }>;
  searchParams: Promise<{ semana?: string; aba?: string }>;
}) {
  const user = await requireAuth();
  if (!podeVerModuloCheck(user.role)) notFound();
  const { assessorId } = await params;
  if (!UUID.test(assessorId)) notFound();
  const sp = await searchParams;
  const semana = resolverSemana(sp.semana, getTodayDate());
  const conduz = podeConduzirCheck(user.role);
  if (!conduz && user.id !== assessorId) notFound();

  const d = await getCheckDetalhe(assessorId, semana);
  if (!d) notFound();
  const status = d.check?.status ?? null;
  const podeVer = podeVerCheckDoAssessor(user, assessorId, status);
  const aba = sp.aba === "checkout" ? "checkout" : "checkin";

  const abaHref = (a: string) => `/check/${assessorId}?semana=${semana}&aba=${a}`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        {conduz && (
          <Link href={`/check?semana=${semana}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Todos os assessores
          </Link>
        )}
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ClipboardCheck className="h-6 w-6 text-primary" /> Check · {d.assessor.nome}
        </h1>
        <p className="text-sm text-muted-foreground">
          {rotuloSemana(semana)}{status ? ` · ${STATUS_LABEL[status]}` : ""}
        </p>
      </header>

      {d.semTabela && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Falta aplicar a migration <code>20261125000000_check_semanal.sql</code> no Supabase.
        </p>
      )}

      {/* ── Visão do assessor ─────────────────────────────── */}
      {!conduz && (
        !podeVer || !d.check ? (
          <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            Seu check-in desta semana ainda não foi liberado. Assim que liberarem, a lista aparece aqui.
          </p>
        ) : status === "fechado" ? (
          <ResultadoSemana itens={d.itens} />
        ) : (
          <ChecklistAssessor itens={d.itens} editavel={status === "liberado"} />
        )
      )}

      {/* ── Visão de quem conduz (sócio/adm) ─────────────── */}
      {conduz && (
        <>
          <nav className="flex gap-1 border-b">
            {[["checkin", "Check-in (segunda)"], ["checkout", "Check-out (quinta)"]].map(([id, label]) => (
              <Link
                key={id}
                href={abaHref(id)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                  aba === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {aba === "checkin" && (
            !d.check ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm">O check-in desta semana ainda não começou. Os itens não feitos da última semana fechada entram sozinhos.</p>
                <IniciarCheckButton assessorId={assessorId} semana={semana} />
              </div>
            ) : status === "fechado" ? (
              <ResultadoSemana itens={d.itens} />
            ) : (
              <div className="space-y-4">
                {status !== "liberado" && (
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Gravar a reunião de check-in</p>
                    <p className="text-xs text-muted-foreground">
                      Escolha &ldquo;Online&rdquo; e, quando o navegador pedir, selecione a aba do Google Meet com &ldquo;Compartilhar áudio&rdquo; ligado.
                      Ao terminar, a transcrição leva alguns minutos e os itens aparecem aqui para revisar.
                    </p>
                    <GravadorReuniao
                      checkSemanalId={d.check.id}
                      modoInicial="online"
                      rotuloBotao={status === "processando" || d.itens.length > 0 ? "Gravar de novo" : "Gravar check-in"}
                      tituloInicial={`Check-in ${d.assessor.nome} (${semana.slice(8, 10)}/${semana.slice(5, 7)})`}
                    />
                  </div>
                )}
                {status === "processando" && (
                  <div className="flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {d.check.meeting_status === "failed"
                      ? "A transcrição falhou. Grave de novo ou inclua os itens na mão."
                      : "Transcrevendo a reunião e montando os itens… esta página atualiza sozinha."}
                    {d.check.meeting_status !== "failed" && <AutoRefresh />}
                  </div>
                )}
                {status === "liberado" && (
                  <p className="text-sm text-muted-foreground">
                    Liberado para o assessor. Você ainda pode ajustar ou incluir itens até o check-out.
                  </p>
                )}
                <CheckinEditor checkId={d.check.id} itens={d.itens} carteira={d.carteira} liberado={status === "liberado"} />
              </div>
            )
          )}

          {aba === "checkout" && (
            !d.check || status === "aberto" || status === "processando" || status === "em_revisao" ? (
              <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Libere o check-in desta semana antes de fazer o check-out.
              </p>
            ) : status === "fechado" ? (
              <ResultadoSemana itens={d.itens} />
            ) : (
              <CheckoutPanel checkId={d.check.id} itens={d.itens} />
            )
          )}
        </>
      )}
    </div>
  );
}
