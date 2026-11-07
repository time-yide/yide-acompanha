import type { Metadata } from "next";
import { YIDE_NAP } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "Política de privacidade do site | Yide Digital",
  description: "Como o site da Yide Digital usa cookies, ferramentas de medição e dados de contato, de acordo com a LGPD.",
  alternates: { canonical: "/politica-de-privacidade" },
};

const ATUALIZADO_EM = "7 de novembro de 2026";

export default function PoliticaPrivacidade() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 text-neutral-800 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:[font-family:var(--font-display)] [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_ul]:space-y-2">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight [font-family:var(--font-display)]">Política de privacidade do site</h1>
        <p className="mt-3 text-sm text-neutral-500">Última atualização: {ATUALIZADO_EM}</p>
      </header>

      <p>
        Esta política explica como o site yidedigital.com.br, da {YIDE_NAP.nome} (CNPJ 48.380.404/0001-84, {YIDE_NAP.rua}, {YIDE_NAP.cidade} - {YIDE_NAP.uf}),
        trata dados de quem visita o site, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
      </p>

      <h2>O que coletamos</h2>
      <ul>
        <li><strong>Dados de navegação:</strong> páginas visitadas, de onde a visita veio (por exemplo, Google, Instagram ou um anúncio), tipo de aparelho e cidade aproximada. Esses dados não identificam você pelo nome.</li>
        <li><strong>Dados de contato:</strong> só quando você decide falar com a gente pelo WhatsApp ou preencher o diagnóstico. Aí recebemos o que você enviar, como nome, empresa, cidade e telefone.</li>
      </ul>

      <h2>Cookies e ferramentas de medição</h2>
      <p>Ao entrar no site, você escolhe no aviso de cookies:</p>
      <ul>
        <li><strong>Aceitar:</strong> liberamos o Google Analytics, a medição do Google Ads e, quando ativos, o pixel da Meta e o pixel do nosso CRM. Eles usam cookies para medir visitas e saber quais anúncios trazem contatos.</li>
        <li><strong>Só o essencial:</strong> os cookies de análise e de anúncio ficam desligados. O Google recebe apenas sinais agregados, sem cookies (Modo de Consentimento).</li>
      </ul>
      <p>Para mudar sua escolha, apague os cookies e os dados deste site no seu navegador; o aviso aparece de novo.</p>

      <h2>Para que usamos</h2>
      <ul>
        <li>Responder quem entra em contato e preparar o diagnóstico pedido.</li>
        <li>Entender quais páginas e anúncios funcionam melhor e melhorar o site.</li>
        <li>Medir o resultado das nossas campanhas de anúncio.</li>
      </ul>
      <p>Não vendemos dados pessoais.</p>

      <h2>Com quem compartilhamos</h2>
      <p>
        Com os serviços que fazem o site e o atendimento funcionarem: Google (Analytics e Ads), Meta (WhatsApp e, com aceite, o pixel),
        Vercel (hospedagem) e o Lyide, nosso CRM, onde ficam as conversas de atendimento. Também podemos informar dados quando a lei ou uma autoridade exigir.
      </p>

      <h2>Por quanto tempo guardamos</h2>
      <p>Pelo tempo necessário para o atendimento e a relação comercial, ou pelo prazo que a lei exigir. Dados de navegação seguem os prazos de retenção configurados nas ferramentas de medição.</p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir confirmação, acesso, correção, anonimização ou exclusão dos seus dados e revogar consentimentos.
        Escreva para <strong>{YIDE_NAP.email}</strong> ou fale pelo WhatsApp {YIDE_NAP.telefone}. Respondemos em até 15 dias.
      </p>

      <h2>Alterações</h2>
      <p>Esta política pode mudar. A versão em vigor fica sempre nesta página, com a data da última atualização.</p>
    </article>
  );
}
