import Link from "next/link";
import { MapPin, ArrowUpRight } from "lucide-react";
import { FaqAberto } from "@/components/site/FaqAberto";
import { FAQ_LOCAL } from "@/lib/site/faq-local";
import { YIDE_NAP } from "@/lib/seo/config";

// Clientes de Cuiabá com número (texto no HTML para o Google e as IAs).
const CASES_LOCAIS = [
  { cliente: "Nazca Sushi", valor: "+R$ 400 mil", rotulo: "por mês, saindo de R$ 20 mil" },
  { cliente: "Casa 925", valor: "7 dígitos", rotulo: "por ano, saindo de R$ 25 mil por mês" },
  { cliente: "Kai Poke", valor: "+R$ 50 mil", rotulo: "por mês em 1 ano de delivery" },
];

const ENDERECO_MAPA = `${YIDE_NAP.nome}, ${YIDE_NAP.rua}, ${YIDE_NAP.cidade} - ${YIDE_NAP.uf}`;

/** Seção local da home: reforça "agência de marketing em Cuiabá" com endereço, cases da cidade, mapa e FAQ. */
export function AgenciaCuiaba() {
  return (
    <section id="agencia-de-marketing-em-cuiaba" className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-teal-600">Cuiabá e Várzea Grande</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 [font-family:var(--font-display)] sm:text-4xl">
              Agência de marketing em Cuiabá, com resultado medido em vendas
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-neutral-600">
              A Yide Digital é uma agência de marketing digital de Cuiabá. Cuidamos de anúncios, conteúdo, site e
              atendimento no WhatsApp para empresas de Cuiabá, Várzea Grande e todo o Mato Grosso, com reunião
              presencial na nossa sede e relatório com custo por conversa e por venda.
            </p>
            <p className="mt-4 flex items-start gap-2 text-neutral-700">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden />
              <span>{YIDE_NAP.rua}, {YIDE_NAP.cidade} - {YIDE_NAP.uf}, CEP {YIDE_NAP.cep}</span>
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-3">
              {CASES_LOCAIS.map((c) => (
                <li key={c.cliente} className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4">
                  <p className="text-2xl font-extrabold text-teal-700 [font-family:var(--font-display)]">{c.valor}</p>
                  <p className="mt-1 text-sm text-neutral-600">{c.rotulo}</p>
                  <p className="mt-2 text-sm font-semibold text-neutral-900">{c.cliente}</p>
                </li>
              ))}
            </ul>
            <Link href="/cases" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900">
              Ver todos os cases de Cuiabá e região <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-neutral-200">
              <iframe
                title={`Mapa: ${ENDERECO_MAPA}`}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(ENDERECO_MAPA)}&z=16&output=embed`}
                className="h-64 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <FaqAberto itens={FAQ_LOCAL} />
          </div>
        </div>
      </div>
    </section>
  );
}
