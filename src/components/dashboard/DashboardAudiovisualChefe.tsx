import { FixoCard } from "./personal/FixoCard";
import { ComissaoCard } from "./personal/ComissaoCard";
import { MinhasTarefasPendentes } from "./personal/MinhasTarefasPendentes";
import { EquipeAudiovisualSection } from "./audiovisual/EquipeAudiovisualSection";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import type { Periodo } from "@/lib/dashboard/personal";

interface Props {
  userId: string;
  nome: string;
  periodo?: Periodo;
}

export async function DashboardAudiovisualChefe({ userId, nome, periodo = "mes_atual" }: Props) {
  const primeiroNome = nome.split(" ")[0];

  return (
    <HiddenValuesProvider>
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Olá, {primeiroNome}</h1>
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
      </div>
    </HiddenValuesProvider>
  );
}
