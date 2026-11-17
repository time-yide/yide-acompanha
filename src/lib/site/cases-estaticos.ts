// Cases da Yide escritos a partir dos vídeos de case (transcrição do que o cliente
// e a Yide disseram). Só números ditos nos vídeos. Entram no site junto com os
// cases do banco (seo_cases); se o banco tiver o mesmo slug, vale o do banco.
import type { CasePublico } from "@/lib/seo/case-tipos";

export interface CaseEstatico extends CasePublico {
  youtubeId: string | null;
  duracao: string | null; // ISO 8601, para o JSON-LD do vídeo
}

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const CASES_ESTATICOS: CaseEstatico[] = [
  {
    slug: "nazca-sushi-delivery",
    cliente: "Nazca Sushi",
    segmento: "Delivery de sushi",
    localidade: "Cuiabá-MT",
    desafio: "Delivery de sushi faturando R$ 20 mil por mês e querendo crescer.",
    solucao: "Conteúdo que dá fome, anúncio na hora da fome e pedido chegando direto pela vitrine do Lyide.",
    resultados: [
      { valor: "+R$ 400 mil", rotulo: "por mês hoje" },
      { valor: "R$ 20 mil", rotulo: "por mês quando começou com a Yide" },
      { valor: "20x", rotulo: "mais faturamento" },
    ],
    conteudo_md: `## O ponto de partida

A Nazca Sushi é um delivery de sushi em Cuiabá. Quando começou com a Yide, faturava **R$ 20 mil por mês**.

## O que a Yide fez

- **Conteúdo que dá fome:** fotos e vídeos pensados para despertar vontade de pedir.
- **Anúncio na hora da fome:** campanhas rodando nos horários em que as pessoas decidem o que vão comer.
- **Pedido direto:** o cliente chega pela vitrine do Lyide e o pedido cai organizado, sem se perder no WhatsApp.

## O resultado

Hoje a Nazca fatura **mais de R$ 400 mil por mês**, **20 vezes mais** do que no começo. Não foi sorte, foi método.

## Para quem tem delivery

Se o seu delivery depende só de aplicativo ou de indicação, o caminho é o mesmo: conteúdo que dá vontade, anúncio no horário certo e atendimento rápido.`,
    depoimento_texto: "",
    depoimento_autor: "",
    cover_image_url: thumb("pkGdOf6QeU8"),
    meta_title: "Case Nazca Sushi: delivery de R$ 20 mil para R$ 400 mil por mês | Yide Digital",
    meta_description: "Como a Nazca Sushi, delivery de Cuiabá, saiu de R$ 20 mil para mais de R$ 400 mil por mês com conteúdo, anúncio na hora da fome e o Lyide.",
    youtubeId: "pkGdOf6QeU8",
    duracao: "PT33S",
  },
  {
    slug: "kai-poke-delivery",
    cliente: "Kai Poke",
    segmento: "Delivery de poke",
    localidade: "Cuiabá-MT",
    desafio: "Abrir um delivery do zero e fazer ele vender desde o primeiro mês.",
    solucao: "A Yide pegou o projeto desde a abertura: conteúdo que dá fome e anúncio na hora da fome.",
    resultados: [
      { valor: "+R$ 50 mil", rotulo: "por mês" },
      { valor: "1 ano", rotulo: "de delivery para chegar lá" },
      { valor: "Do zero", rotulo: "a Yide acompanhou desde a abertura" },
    ],
    conteudo_md: `## O ponto de partida

A Kai Poke é um delivery de poke em Cuiabá. A Yide acompanhou o projeto **desde a abertura**.

## O que a Yide fez

- **Conteúdo que dá fome** desde o primeiro dia.
- **Anúncio na hora da fome**, nos horários de pedido.
- **Pedido chegando** organizado para a equipe atender rápido.

## O resultado

Em **apenas 1 ano de delivery**, a Kai Poke passou de **R$ 50 mil por mês**.

## Para quem vai abrir um delivery

Começar com método faz diferença: conteúdo, anúncio no horário certo e atendimento rápido desde o primeiro pedido.`,
    depoimento_texto: "",
    depoimento_autor: "",
    cover_image_url: thumb("1JtkT6MPUtI"),
    meta_title: "Case Kai Poke: mais de R$ 50 mil por mês em 1 ano de delivery | Yide Digital",
    meta_description: "Como a Kai Poke, delivery de poke em Cuiabá, passou de R$ 50 mil por mês em 1 ano com a Yide Digital desde a abertura.",
    youtubeId: "1JtkT6MPUtI",
    duracao: "PT24S",
  },
  {
    slug: "casa-925-joalheria",
    cliente: "Casa 925",
    segmento: "Joalheria",
    localidade: "Cuiabá-MT",
    desafio: "Uma joalheria vendendo cerca de R$ 25 mil por mês.",
    solucao: "Quatro anos de parceria: ideias, tráfego pago e acompanhamento de cada cliente até a venda, com o Lyide mostrando de onde vem cada venda.",
    resultados: [
      { valor: "7 dígitos", rotulo: "de faturamento por ano hoje" },
      { valor: "R$ 25 mil", rotulo: "por mês no começo" },
      { valor: "4 anos", rotulo: "de parceria e uma loja nova no shopping" },
    ],
    conteudo_md: `## O ponto de partida

Quando a Casa 925 começou com a Yide, a loja vendia **cerca de R$ 25 mil por mês**.

## O que a Yide fez

- **Ideias e campanhas** para cada fase da loja.
- **Tráfego pago** levando clientes para o WhatsApp.
- **Acompanhamento até a venda:** com o Lyide, a Casa 925 vê de onde vem cada cliente, do anúncio até a venda fechada.

## O resultado

Hoje são **7 dígitos de faturamento por ano**. Em **4 anos de parceria**, a Casa 925 cresceu, evoluiu e abriu **mais um ponto físico, agora no shopping**.

## Para joalherias e lojas

Joia é compra de confiança. O que funciona é presença constante, anúncio bem feito e cada contato acompanhado até virar venda.`,
    depoimento_texto: "Momentos de virada de chave, momentos em que a gente teve um grande crescimento: vocês fizeram parte. E é isso, 2027 estaremos juntos de novo.",
    depoimento_autor: "Casa 925",
    cover_image_url: thumb("xnJH_fl5Ef0"),
    meta_title: "Case Casa 925: joalheria de R$ 25 mil por mês a 7 dígitos por ano | Yide Digital",
    meta_description: "Como a joalheria Casa 925 saiu de R$ 25 mil por mês para 7 dígitos por ano em 4 anos com a Yide Digital, e abriu loja no shopping.",
    youtubeId: "xnJH_fl5Ef0",
    duracao: "PT1M7S",
  },
  {
    slug: "ccr-montagens-industriais",
    cliente: "CCR Montagens Industriais",
    segmento: "Montagem elétrica e automação",
    localidade: "Mato Grosso",
    desafio: "A CCR investia em anúncio no Google, mas não sabia quanto disso virava venda de verdade.",
    solucao: "Com o Lyide, cada conversa chega marcada com o anúncio que trouxe, e o laboratório mostra faturamento, leads e fechamento por canal.",
    resultados: [
      { valor: "10x", rotulo: "de retorno no Google (R$ 412 viraram mais de R$ 4 mil)" },
      { valor: "R$ 21.660", rotulo: "de faturamento em 30 dias" },
      { valor: "108", rotulo: "leads novos em 30 dias" },
    ],
    conteudo_md: `## O ponto de partida

A CCR Montagens Industriais faz montagem elétrica, painéis e automação em Mato Grosso. Investia em anúncio no Google, mas ficava a dúvida: **quanto disso virava venda de verdade?** Anúncio sem medição é aposta.

## O que a Yide fez

- **Anúncios no Google** voltados para quem procura o serviço.
- **Lyide:** cada conversa chega no WhatsApp marcada com o anúncio que trouxe.
- **Laboratório do Lyide:** faturamento, leads e taxa de fechamento por canal, em um lugar só.

## O resultado (últimos 30 dias)

- **R$ 21.660** de faturamento
- **108 leads** novos
- **Quase 28%** de fechamento
- No Google: **R$ 412 investidos** e **mais de R$ 4 mil em vendas**, cerca de **10 vezes de retorno**

Hoje a CCR não chuta. Ela sabe.

## Para empresas de serviço e indústria

Se você anuncia e não sabe quanto volta, o primeiro passo é medir. Com o anúncio ligado à venda, fica claro onde colocar mais dinheiro.`,
    depoimento_texto: "",
    depoimento_autor: "",
    cover_image_url: thumb("MqLjc4EoY04"),
    meta_title: "Case CCR Montagens Industriais: 10x de retorno no Google | Yide Digital",
    meta_description: "Como a CCR Montagens Industriais, de Mato Grosso, passou a medir cada venda: R$ 21.660 em 30 dias, 108 leads e 10x de retorno no Google.",
    youtubeId: "MqLjc4EoY04",
    duracao: "PT54S",
  },
  {
    slug: "atena-rh",
    cliente: "Atena RH",
    segmento: "Recrutamento e seleção",
    localidade: "Cuiabá-MT",
    desafio: "Investia R$ 30 mil por mês em anúncios e tinha resultado baixíssimo.",
    solucao: "A Yide assumiu o tráfego pago, as artes e as redes sociais, com uma campanha para cada vaga.",
    resultados: [
      { valor: "Mais resultado", rotulo: "com bem menos verba que antes" },
      { valor: "R$ 30 mil", rotulo: "por mês em anúncios antes, com pouco retorno" },
      { valor: "Faturamento", rotulo: "com diferença sentida, nas palavras da cliente" },
    ],
    conteudo_md: `## O ponto de partida

A Atena RH é uma empresa de recrutamento. Pagava **R$ 30 mil por mês em anúncios** e o resultado era baixíssimo: o WhatsApp continuava parado.

## O que a Yide fez

- **Tráfego pago** reorganizado, com uma campanha para cada vaga.
- **Artes e redes sociais** feitas pela Yide.
- **Acompanhamento** de cada contato até virar negócio.

## O resultado

Hoje a Atena **investe bem menos** e tem **um resultado muito maior** do que tinha, com diferença sentida no faturamento. Não é sobre gastar mais, é sobre investir certo.

## Para prestadores de serviço

Se você paga anúncio todo mês e o WhatsApp não toca, o problema raramente é a verba. Quase sempre é a forma de investir.`,
    depoimento_texto: "Desde que assumiram nosso tráfego, nossas artes e redes sociais, sentimos uma diferença muito grande, inclusive no nosso faturamento. Todo mundo é muito atencioso, comprometido e realmente veste a camisa da nossa empresa.",
    depoimento_autor: "Rafaela, Atena RH",
    cover_image_url: thumb("nx0dtPCvbxo"),
    meta_title: "Case Atena RH: menos verba em anúncio e mais resultado | Yide Digital",
    meta_description: "A Atena RH gastava R$ 30 mil por mês em anúncios com pouco retorno. Com a Yide, investe bem menos e tem resultado muito maior.",
    youtubeId: "nx0dtPCvbxo",
    duracao: "PT52S",
  },
  {
    slug: "centra-mt",
    cliente: "Centra MT",
    segmento: "B2B",
    localidade: "Mato Grosso",
    desafio: "Tudo caía no mesmo WhatsApp e não dava para saber quanto vinha de cada canal, nem do link da bio.",
    solucao: "A Centra usa a página do Lyide na bio, com cada botão sendo um link rastreável.",
    resultados: [
      { valor: "R$ 19 mil", rotulo: "em vendas vindas do Instagram" },
      { valor: "R$ 9 mil", rotulo: "em vendas vindas do Facebook" },
      { valor: "Cada botão", rotulo: "da bio medido separado" },
    ],
    conteudo_md: `## O ponto de partida

Você sabe quanto vende pelo link da sua bio? A maioria não faz ideia, porque tudo cai no mesmo WhatsApp. A Centra MT tinha essa dúvida.

## O que a Yide fez

- **Página do Lyide na bio:** cada botão é um link rastreável.
- **Laboratório do Lyide:** cada canal aparece separado, e dá para ver até qual botão o cliente clicou.

## O resultado

No laboratório, a Centra vê as vendas por canal: **R$ 19 mil vindos do Instagram** e **R$ 9 mil do Facebook**, com o link da bio aparecendo separado. Agora ela sabe onde investir.

## Para quem vende pelo Instagram

Medir a bio é simples e muda a decisão de onde colocar tempo e dinheiro.`,
    depoimento_texto: "",
    depoimento_autor: "",
    cover_image_url: thumb("NMrQ8VqMsXU"),
    meta_title: "Case Centra MT: quanto vende o link da bio | Yide Digital",
    meta_description: "Como a Centra MT passou a medir as vendas por canal com a página do Lyide na bio: R$ 19 mil pelo Instagram e R$ 9 mil pelo Facebook.",
    youtubeId: "NMrQ8VqMsXU",
    duracao: "PT32S",
  },
  {
    slug: "pantanal-auto-parts",
    cliente: "Pantanal Auto Parts",
    segmento: "Autopeças",
    localidade: "",
    desafio: "Não sabia quanto tempo cada vendedor levava para responder o cliente no WhatsApp.",
    solucao: "O laboratório do Lyide mostra o tempo de resposta de cada vendedor, e a IA aponta clientes sem resposta e o que fazer na semana.",
    resultados: [
      { valor: "< 1 min", rotulo: "tempo de resposta do vendedor mais rápido" },
      { valor: "44 min", rotulo: "média do outro vendedor, agora visível" },
      { valor: "IA", rotulo: "apontando clientes esperando há mais de 1 dia" },
    ],
    conteudo_md: `## O ponto de partida

O cliente pergunta, pergunta de novo e fica esperando. A Pantanal Auto Parts tinha uma dúvida: **quanto tempo cada vendedor leva para responder?**

## O que a Yide fez

- **Laboratório do Lyide:** tempo de resposta de cada vendedor, em minutos.
- **IA do Lyide:** aponta os gargalos, os clientes sem resposta e quem está esperando há mais de um dia, e diz o que fazer na semana para vender mais.

## O resultado

Agora a loja vê a diferença: **um vendedor responde em menos de 1 minuto**, o outro **em média em 44 minutos**. Sem achismo, com dado.

## Para lojas com time de vendas

Tempo de resposta é venda. Quem responde primeiro costuma fechar.`,
    depoimento_texto: "",
    depoimento_autor: "",
    cover_image_url: thumb("xYuHB4mJfzM"),
    meta_title: "Case Pantanal Auto Parts: tempo de resposta de cada vendedor | Yide Digital",
    meta_description: "Como a Pantanal Auto Parts passou a ver o tempo de resposta de cada vendedor no WhatsApp com o Lyide: de menos de 1 minuto a 44 minutos.",
    youtubeId: "xYuHB4mJfzM",
    duracao: "PT44S",
  },
  {
    slug: "porto-motos",
    cliente: "Porto Motos",
    segmento: "Motopeças e oficina",
    localidade: "",
    desafio: "Muita conversa no WhatsApp e pouca organização: ninguém sabia quem respondeu e lead se perdia no meio.",
    solucao: "A Porto Motos usa o Lyide em todas as lojas: cada cliente vira um card e cada conversa pode ser acompanhada mensagem por mensagem.",
    resultados: [
      { valor: "Todas as lojas", rotulo: "atendendo no Lyide" },
      { valor: "1 card", rotulo: "por cliente, nada se perde" },
      { valor: "100%", rotulo: "das conversas acompanhadas mensagem por mensagem" },
    ],
    conteudo_md: `## O ponto de partida

A Porto Motos tem motopeças, oficina e muito cliente chamando no WhatsApp. Era **muita conversa e pouca organização**: cliente perguntando, ninguém sabendo quem respondeu, e lead se perdendo no meio. Lead perdido na bagunça é venda perdida.

## O que a Yide fez

- **Lyide em todas as lojas.**
- **Cada cliente vira um card** no funil, e nada se perde.
- **Acompanhamento mensagem por mensagem** para o dono cuidar do atendimento.

## O resultado

Organização que vira resultado: o dono acompanha cada conversa e zela pelo atendimento de todas as lojas.

## Para empresas com várias lojas ou vendedores

Quando todo mundo atende no mesmo lugar, o dono enxerga o que está acontecendo e o cliente não fica sem resposta.`,
    depoimento_texto: "Parabéns pelo CRM. Consegui unir e acompanhar mensagem por mensagem, pra poder zelar do atendimento com o cliente.",
    depoimento_autor: "Anderson, Porto Motos",
    cover_image_url: thumb("qEt1lq8ZnfA"),
    meta_title: "Case Porto Motos: WhatsApp organizado em todas as lojas | Yide Digital",
    meta_description: "Como a Porto Motos, de motopeças e oficina, organizou o WhatsApp de todas as lojas com o Lyide e passou a acompanhar cada conversa.",
    youtubeId: "qEt1lq8ZnfA",
    duracao: "PT54S",
  },
  {
    slug: "meira-imports",
    cliente: "Meira Imports",
    segmento: "Loja de importados",
    localidade: "Cuiabá-MT",
    desafio: "Uma das maiores lojas de importados de Cuiabá queria mais procura e mais venda fechada.",
    solucao: "Anúncios levando clientes para o WhatsApp, com período de ajuste no início e cada conversa acompanhada até a venda.",
    resultados: [
      { valor: "Mais procura", rotulo: "depois do período de ajuste" },
      { valor: "Negociação", rotulo: "chegando todos os dias no WhatsApp" },
      { valor: "Venda fechada", rotulo: "nas palavras do próprio cliente" },
    ],
    conteudo_md: `## O ponto de partida

A Meira Imports é uma das maiores lojas de importados de Cuiabá e queria transformar anúncio em venda.

## O que a Yide fez

- **Anúncios** levando clientes direto para o WhatsApp.
- **Período de ajuste no início** para achar o que funciona.
- **Acompanhamento** de cada lead até a venda.

## O resultado

Depois dos ajustes, o próprio cliente mandou o retorno: o lead está chegando, tem procura, tem negociação e **muita venda fechada**.

## Para lojas do interior

Distância não é problema: a Yide atende lojas de todo o Brasil por vídeo.`,
    depoimento_texto: "Passamos aquele tempo de ajuste no início, as coisas estão ajustadas. O lead tá chegando, tá tendo procura, tá tendo negociação, tá tendo muita venda fechada.",
    depoimento_autor: "Meira Imports",
    cover_image_url: thumb("P3iIc8usdas"),
    meta_title: "Case Meira Imports: importados vendendo mais pelo WhatsApp | Yide Digital",
    meta_description: "Como a Meira Imports, uma das maiores lojas de importados de Cuiabá, passou a ter procura, negociação e muita venda fechada com a Yide.",
    youtubeId: "P3iIc8usdas",
    duracao: "PT41S",
  },
  {
    slug: "recanto-country",
    cliente: "Recanto Country",
    segmento: "Loja country",
    localidade: "Cuiabá e Cáceres-MT",
    desafio: "Cada vendedor atendia no próprio celular. Quando saía, levava as conversas, os orçamentos e os clientes.",
    solucao: "As duas lojas passaram a atender no Lyide: todos os vendedores no mesmo lugar e o histórico de cada cliente guardado.",
    resultados: [
      { valor: "2 lojas", rotulo: "atendendo no mesmo lugar" },
      { valor: "0", rotulo: "clientes perdidos quando um vendedor sai" },
      { valor: "Histórico", rotulo: "de cada cliente guardado na empresa" },
    ],
    conteudo_md: `## O ponto de partida

A Recanto Country tem duas lojas, uma em Cuiabá e outra em Cáceres, e vários vendedores atendendo pelo WhatsApp. Só que **cada vendedor atendia no próprio número, no celular dele**. Quando o vendedor saía, levava tudo junto: as conversas, os orçamentos e os clientes.

## O que a Yide fez

- **Lyide nas duas lojas.**
- **Todos os vendedores atendendo no mesmo lugar.**
- **Histórico de cada cliente guardado** na empresa.

## O resultado

O vendedor pode mudar, o cliente continua sendo da Recanto.

## Para quem tem equipe de vendas no WhatsApp

Se cada vendedor usa o próprio celular, a carteira de clientes é dele, não sua. Centralizar o atendimento protege o seu negócio.`,
    depoimento_texto: "",
    depoimento_autor: "",
    cover_image_url: null,
    meta_title: "Case Recanto Country: o cliente fica com a loja, não com o vendedor | Yide Digital",
    meta_description: "Como a Recanto Country, com lojas em Cuiabá e Cáceres, centralizou o WhatsApp dos vendedores no Lyide e deixou de perder clientes.",
    youtubeId: null,
    duracao: null,
  },
];

export function caseEstaticoPorSlug(slug: string): CaseEstatico | null {
  return CASES_ESTATICOS.find((c) => c.slug === slug) ?? null;
}
