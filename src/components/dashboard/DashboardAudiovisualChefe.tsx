import { Suspense } from "react";
import { FixoCard } from "./personal/FixoCard";
import { ComissaoCard } from "./personal/ComissaoCard";
import { MinhasTarefasPendentes } from "./personal/MinhasTarefasPendentes";
import { EquipeAudiovisualSection } from "./audiovisual/EquipeAudiovisualSection";
import { PainelAudiovisualSection } from "./audiovisual/PainelAudiovisualSection";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { ListSkeleton, RemuneracaoSkeleton } from "./sections";
import type { Periodo } from "@/lib/dashboard/personal";

interface Props {
  userId: string;
  nome: string;
  periodo?: Periodo;
}

// Shell síncrono: a saudação renderiza na hora (TTFB não espera query). Cada
// sub-componente async (FixoCard, ComissaoCard, MinhasTarefasPendentes,
// EquipeAudiovisualSection, PainelAudiovisualSection) faz seu próprio fetch e
// vai dentro de <Suspense>, streamando quando sua query resolve — antes todos
// bloqueavam o primeiro byte até a query mais lenta.
export function DashboardAudiovisualChefe({ userId, nome, periodo = "mes_atual" }: Props) {
  const primeiroNome = nome.split(" ")[0];

  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {primeiroNome}</h1>
            <p className="text-sm text-muted-foreground">Sua remuneração e a equipe audiovisual.</p>
          </div>
          <HiddenValueToggle />
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Suspense fallback={<RemuneracaoSkeleton />}>
            <FixoCard userId={userId} />
          </Suspense>
          <Suspense fallback={<RemuneracaoSkeleton />}>
            <ComissaoCard userId={userId} />
          </Suspense>
        </div>

        <Suspense fallback={<ListSkeleton rows={5} />}>
          <MinhasTarefasPendentes userId={userId} />
        </Suspense>

        <Suspense fallback={<ListSkeleton rows={5} />}>
          <EquipeAudiovisualSection periodo={periodo} />
        </Suspense>

        <Suspense fallback={<ListSkeleton rows={4} />}>
          <PainelAudiovisualSection />
        </Suspense>
      </div>
    </HiddenValuesProvider>
  );
}
