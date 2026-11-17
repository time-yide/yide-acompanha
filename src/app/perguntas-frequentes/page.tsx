import Link from "next/link";
import type { Metadata } from "next";
import { FAQ_GERAL } from "@/lib/site/faq-geral";
import { CONTEUDO_SERVICOS } from "@/lib/site/servicos-conteudo";
import { SEED_SERVICOS } from "@/lib/seo/config";
import { FaqAberto } from "@/components/site/FaqAberto";
import { WHATSAPP_SITE } from "@/lib/site/contato";

export const metadata: Metadata = {
  title: "Perguntas frequentes | Yide Digital, agência em Cuiabá",
  description: "Respostas sobre a Yide Digital: onde fica, quem atende, como funciona, preços, tráfego pago, CRM com IA, redes sociais, sites, e-commerce e Mercado Livre.",
  alternates: { canonical: "/perguntas-frequentes" },
};

const nomeDo = (slug: string) => SEED_SERVICOS.find((s) => s.slug === slug)?.nome ?? slug;

export default function PerguntasFrequentes() {
  const todas = [...FAQ_GERAL, ...CONTEUDO_SERVICOS.flatMap((c) => c.faq)];
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: todas.map((f) => ({ "@type": "Question", name: f.pergunta, acceptedAnswer: { "@type": "Answer", text: f.resposta } })),
  }).replace(/</g, "\\u003c");

  return (
    <div className="mx-auto max-w-3xl space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight [font-family:var(--font-display)] sm:text-5xl">Perguntas frequentes</h1>
        <p className="mt-4 text-lg text-neutral-700">
          Respostas diretas sobre a Yide e sobre cada serviço. Não achou o que procura?{" "}
          <a href={WHATSAPP_SITE} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-700 hover:underline">Pergunte no WhatsApp</a>.
        </p>
      </header>

      <section>
        <h2 className="mb-5 text-2xl font-extrabold tracking-tight [font-family:var(--font-display)]">Sobre a Yide</h2>
        <FaqAberto itens={FAQ_GERAL} />
      </section>

      {CONTEUDO_SERVICOS.map((c) => (
        <section key={c.slug}>
          <h2 className="mb-5 text-2xl font-extrabold tracking-tight [font-family:var(--font-display)]">
            <Link href={`/servicos/${c.slug}`} className="hover:text-teal-700">{nomeDo(c.slug)}</Link>
          </h2>
          <FaqAberto itens={c.faq} />
        </section>
      ))}
    </div>
  );
}
