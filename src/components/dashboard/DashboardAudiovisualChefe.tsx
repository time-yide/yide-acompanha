import { FixoCard } from "./personal/FixoCard";
import { ComissaoCard } from "./personal/ComissaoCard";
import { EquipeAudiovisualSection } from "./audiovisual/EquipeAudiovisualSection";
import type { Periodo } from "@/lib/dashboard/personal";

interface Props {
  userId: string;
  nome: string;
  periodo?: Periodo;
}

export async function DashboardAudiovisualChefe({ userId, nome, periodo = "mes_atual" }: Props) {
  const primeiroNome = nome.split(" ")[0];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">Sua remuneração e a equipe audiovisual.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <FixoCard userId={userId} />
        <ComissaoCard userId={userId} />
      </div>

      <EquipeAudiovisualSection periodo={periodo} />
    </div>
  );
}
