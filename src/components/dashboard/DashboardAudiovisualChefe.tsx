import { Suspense } from "react";
import { FixoCard } from "./personal/FixoCard";
import { ComissaoCard } from "./personal/ComissaoCard";
import { MinhasTarefasPendentes } from "./personal/MinhasTarefasPendentes";
import { EquipeAudiovisualSection } from "./audiovisual/EquipeAudiovisualSection";
import { PainelAudiovisualSection } from "./audiovisual/PainelAudiovisualSection";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { InstagramPostsSection } from "./sections";
import type { Periodo } from "@/lib/dashboard/personal";

function IgListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-muted/50" />
      ))}
    </div>
  );
}

interface Props {
  userId: string;
  nome: string;
  periodo?: Periodo;
}

export async function DashboardAudiovisualChefe({ userId, nome, periodo = "mes_atual" }: Props) {
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
          <FixoCard userId={userId} />
          <ComissaoCard userId={userId} />
        </div>

        <MinhasTarefasPendentes userId={userId} />

        <EquipeAudiovisualSection periodo={periodo} />

        <Suspense fallback={<IgListSkeleton />}>
          <InstagramPostsSection assessorId={null} titulo="Postagens no Instagram" />
        </Suspense>

        <PainelAudiovisualSection />
      </div>
    </HiddenValuesProvider>
  );
}
