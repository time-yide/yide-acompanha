import type { Metadata } from "next";
import { FormDiagnostico } from "./FormDiagnostico";

export const metadata: Metadata = {
  title: "Diagnóstico de marketing gratuito | Yide Digital",
  description: "Peça um diagnóstico gratuito de marketing e vendas para sua empresa. Resposta no mesmo dia pelo WhatsApp. Cuiabá e todo o Brasil.",
  alternates: { canonical: "/diagnostico" },
};

export default function DiagnosticoPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_1.1fr]">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-teal-700">Diagnóstico gratuito</p>
        <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-5xl">
          Descubra o que falta para sua empresa vender mais
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-neutral-700">
          Responda 4 perguntas rápidas. A conversa abre no WhatsApp da Yide com as suas respostas, e um especialista retorna no mesmo dia
          com os primeiros pontos de melhoria em anúncios, atendimento e presença no Google.
        </p>
        <ul className="mt-6 space-y-2 text-neutral-700">
          <li>Sem compromisso</li>
          <li>Resposta no mesmo dia</li>
          <li>Atendimento 24 horas</li>
        </ul>
      </header>
      <FormDiagnostico />
    </div>
  );
}
