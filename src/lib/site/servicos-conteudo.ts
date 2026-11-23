// Conteúdo fixo das páginas de serviço (versionado no código). O banco (seo_services)
// continua mandando em nome, ordem e se o serviço está ativo; aqui fica o texto longo
// que dá contexto para o Google e para as IAs. Sem números de resultado inventados.

export interface Etapa { titulo: string; texto: string }
export interface Pergunta { pergunta: string; resposta: string }

export interface ConteudoServico {
  slug: string;
  titulo: string;
  metaTitulo: string;
  metaDescricao: string;
  /** Resposta direta (2 ou 3 frases), a primeira coisa da página. */
  resposta: string;
  entregas: string[];
  etapas: Etapa[];
  paraQuem: string[];
  faq: Pergunta[];
  /** Linha de preço própria (serviço avulso, como cobertura de evento). Quando existe,
   *  substitui "Planos a partir de R$ 1.000. Verba de anúncios à parte." e a pergunta
   *  automática de preço, e o preço vai no próprio FAQ do serviço. */
  precoProprio?: string;
}

export const CONTEUDO_SERVICOS: ConteudoServico[] = [
  {
    slug: "gestao-de-trafego",
    titulo: "Gestão de tráfego pago para empresas de todo o Brasil",
    metaTitulo: "Gestão de Tráfego Pago em Todo o Brasil | Google e Meta Ads",
    metaDescricao: "Gestão de tráfego pago no Google Ads, Meta Ads e Instagram para gerar conversas e vendas. Agência em Cuiabá que atende todo o Brasil.",
    resposta: "A Yide cuida dos seus anúncios no Google, no Instagram e no Facebook para trazer conversas no WhatsApp e vendas, não só cliques. Cada campanha é acompanhada pelo custo por conversa e por venda, com relatório de qual anúncio trouxe cada cliente. Atendemos empresas de todo o Brasil, com reuniões por vídeo e a mesma equipe do começo ao fim.",
    entregas: [
      "Planejamento de campanhas no Google Ads, Meta Ads e Instagram",
      "Criação e teste de anúncios, públicos e palavras-chave",
      "Acompanhamento diário e ajustes de verba com regra, sem achismo",
      "Rastreamento de conversas e vendas pelo CRM Lyide",
      "Relatório com custo por conversa, por lead e por venda",
      "Reunião de resultado e próximos passos",
    ],
    etapas: [
      { titulo: "Diagnóstico", texto: "Entendemos o que você vende, para quem, quanto vale um cliente e o que já foi feito." },
      { titulo: "Estrutura", texto: "Montamos campanhas, públicos, páginas e o rastreamento antes de colocar verba." },
      { titulo: "Teste e aprendizado", texto: "Nas primeiras semanas testamos anúncios e públicos e cortamos o que não traz conversa." },
      { titulo: "Escala", texto: "Com dados suficientes, aumentamos a verba aos poucos no que dá resultado." },
    ],
    paraQuem: ["Comércio e varejo local", "Restaurantes e delivery", "Clínicas e profissionais de saúde", "Empresas B2B e prestadores de serviço"],
    faq: [
      { pergunta: "Quanto investir em tráfego pago para começar?", resposta: "Depende do ticket e da região. Para negócios locais, é comum começar com R$ 20 a R$ 50 por dia em anúncios, além da gestão. No diagnóstico indicamos a verba ideal para o seu caso." },
      { pergunta: "Em quanto tempo aparecem os resultados?", resposta: "As primeiras conversas costumam chegar na primeira semana. A leitura confiável de custo por resultado vem com 2 a 4 semanas de dados, e a otimização continua todo mês." },
      { pergunta: "Google Ads ou Instagram: qual é melhor?", resposta: "O Google pega quem já está procurando o que você vende. O Instagram e o Facebook criam demanda e funcionam bem com oferta visual. Muitos negócios usam os dois, com pesos diferentes." },
      { pergunta: "Vocês atendem fora de Cuiabá?", resposta: "Sim. A Yide fica em Cuiabá e atende empresas de todo o Mato Grosso e do Brasil, com reuniões online." },
    ],
  },
  {
    slug: "crm-ia-dados",
    titulo: "CRM com IA para WhatsApp: Lyide",
    metaTitulo: "CRM com IA para WhatsApp | Lyide by Yide Digital",
    metaDescricao: "Lyide é o CRM com IA da Yide: responde leads no WhatsApp em segundos, organiza o funil e mostra qual anúncio trouxe cada venda.",
    resposta: "O Lyide é o CRM com inteligência artificial da Yide, feito para quem vende pelo WhatsApp. A IA responde cada contato em segundos, qualifica e passa para o vendedor, e o painel mostra qual anúncio trouxe cada venda. Atendemos empresas de todo o Brasil, com reuniões por vídeo e a mesma equipe do começo ao fim.",
    entregas: [
      "WhatsApp centralizado com vários atendentes no mesmo número",
      "IA de pré-atendimento treinada com seus produtos e preços",
      "Funil de vendas em kanban com follow-up automático",
      "Rodízio de leads entre vendedores",
      "Atribuição: de qual anúncio, página ou post veio cada lead e cada venda",
      "Envio de conversões para Google Ads e Meta para melhorar as campanhas",
    ],
    etapas: [
      { titulo: "Configuração", texto: "Conectamos seu WhatsApp, criamos o funil e cadastramos a equipe." },
      { titulo: "Treinamento da IA", texto: "Ensinamos a IA com seus produtos, preços, horários e jeito de falar." },
      { titulo: "Integração", texto: "Ligamos anúncios, site e formulários ao CRM para saber a origem de cada lead." },
      { titulo: "Acompanhamento", texto: "Revisamos as conversas e ajustamos a IA e o funil nas primeiras semanas." },
    ],
    paraQuem: ["Empresas que vendem pelo WhatsApp", "Times comerciais com mais de um vendedor", "Negócios que investem em anúncios", "Clínicas, lojas e prestadores com muito contato"],
    faq: [
      { pergunta: "A IA substitui o vendedor?", resposta: "Não. Ela responde na hora, tira dúvidas comuns e qualifica. Quando o lead está pronto, passa para o vendedor com o histórico da conversa." },
      { pergunta: "Preciso trocar meu número de WhatsApp?", resposta: "Não. O Lyide funciona com o número que você já usa." },
      { pergunta: "Funciona com os anúncios que já rodam?", resposta: "Sim. O Lyide registra de qual anúncio veio cada conversa e pode devolver as vendas para o Google Ads e a Meta otimizarem as campanhas." },
      { pergunta: "Atende empresas de outras cidades?", resposta: "Sim. O Lyide é online e atende empresas de todo o Brasil." },
      { pergunta: "Vocês atendem empresas de outros estados?", resposta: "Sim. O Lyide é um sistema on-line e a implantação é feita por vídeo, para empresas de qualquer estado." },
    ],
  },
  {
    slug: "audiovisual",
    titulo: "Gravação de vídeos e audiovisual em Cuiabá",
    metaTitulo: "Gravação de Vídeos e Reels em Cuiabá | Yide Digital",
    metaDescricao: "Produção de vídeos, reels e gravações para Instagram e anúncios em Cuiabá e Várzea Grande, do roteiro à edição.",
    resposta: "A Yide grava e edita vídeos para Instagram, anúncios e site, do roteiro à entrega. A equipe vai até a sua empresa em Cuiabá e Várzea Grande e produz conteúdo pensado para vender, não só para aparecer.",
    entregas: [
      "Roteiro com gancho, oferta e chamada para ação",
      "Gravação na sua empresa com equipamento profissional",
      "Edição de reels, stories e vídeos para anúncios",
      "Depoimentos de clientes e vídeos de case",
      "Legendas, cortes e versões para cada formato",
      "Calendário de gravações recorrentes",
    ],
    etapas: [
      { titulo: "Roteiro", texto: "Definimos o objetivo de cada vídeo e escrevemos o roteiro com você." },
      { titulo: "Gravação", texto: "Gravamos no seu espaço, com direção para quem aparece no vídeo." },
      { titulo: "Edição", texto: "Editamos nos formatos certos para feed, reels, stories e anúncios." },
      { titulo: "Publicação e teste", texto: "Os melhores vídeos viram anúncios e são medidos pelo resultado." },
    ],
    paraQuem: ["Restaurantes e food service", "Clínicas e consultórios", "Lojas e varejo", "Profissionais que precisam aparecer nas redes"],
    faq: [
      { pergunta: "Vocês gravam na minha empresa?", resposta: "Sim. Em Cuiabá e Várzea Grande a equipe vai até você. Em outras cidades, combinamos gravação local ou remota." },
      { pergunta: "Quantos vídeos saem por gravação?", resposta: "Depende do plano. Uma diária bem planejada costuma render vários vídeos curtos para o mês." },
      { pergunta: "Os vídeos servem para anúncio?", resposta: "Sim. Editamos versões próprias para anúncio, com gancho nos primeiros segundos e chamada clara." },
    ],
  },
  {
    slug: "redes-sociais",
    titulo: "Gestão de redes sociais focada em vendas",
    metaTitulo: "Gestão de Redes Sociais | Instagram que Vende · Yide Digital",
    metaDescricao: "Gestão de Instagram e redes sociais com calendário editorial, conteúdo e foco em gerar conversas e vendas. Cuiabá e todo o Brasil.",
    resposta: "A Yide planeja, cria e publica o conteúdo das suas redes sociais com foco em gerar conversas e vendas. O Instagram deixa de ser vitrine parada e passa a trabalhar junto com os anúncios e o WhatsApp. Atendemos empresas de todo o Brasil, com reuniões por vídeo e a mesma equipe do começo ao fim.",
    entregas: [
      "Planejamento mensal e calendário editorial",
      "Criação de posts, carrosséis, stories e reels",
      "Textos e legendas com chamada para ação",
      "Destaques, bio e link organizados para conversão",
      "Relatório de alcance, engajamento e conversas geradas",
      "Integração com gravação e tráfego pago",
    ],
    etapas: [
      { titulo: "Posicionamento", texto: "Definimos a mensagem, o público e os pilares de conteúdo." },
      { titulo: "Calendário", texto: "Montamos o mês com antecedência para você aprovar." },
      { titulo: "Produção", texto: "Criamos as artes, os textos e os vídeos." },
      { titulo: "Análise", texto: "Medimos o que gera conversa e ajustamos o mês seguinte." },
    ],
    paraQuem: ["Negócios locais que vendem pelo Instagram", "Marcas que querem constância", "Empresas que já anunciam e precisam de conteúdo", "Profissionais liberais"],
    faq: [
      { pergunta: "Quantos posts por semana?", resposta: "Depende do plano e do objetivo. Constância vale mais que volume, e todo plano inclui reels e stories." },
      { pergunta: "Eu aprovo o conteúdo antes?", resposta: "Sim. Você aprova o calendário e as peças pelo sistema antes da publicação." },
      { pergunta: "Redes sociais sozinhas trazem vendas?", resposta: "Ajudam, mas o resultado vem mais rápido junto com anúncios e um bom atendimento no WhatsApp." },
      { pergunta: "Vocês atendem empresas de outros estados?", resposta: "Sim. Planejamento, criação e aprovação são online. Quando o projeto pede gravação, organizamos com um parceiro na sua cidade ou gravamos na sua visita a Cuiabá." },
    ],
  },
  {
    slug: "criacao-de-sites",
    titulo: "Criação de sites e landing pages que vendem",
    metaTitulo: "Criação de Sites e Landing Pages que Vendem | Yide Digital",
    metaDescricao: "Sites e landing pages rápidos, otimizados para Google e para conversão, ligados ao WhatsApp e ao CRM. Cuiabá e todo o Brasil.",
    resposta: "A Yide cria sites e landing pages rápidos, prontos para aparecer no Google e para transformar visita em conversa no WhatsApp. Cada página nasce ligada ao CRM e às tags de anúncio, para medir de onde vem cada cliente. Atendemos empresas de todo o Brasil, com reuniões por vídeo e a mesma equipe do começo ao fim.",
    entregas: [
      "Site institucional e landing pages de campanha",
      "Textos pensados para o Google e para as respostas de IA",
      "Velocidade alta no celular",
      "Botões de WhatsApp com rastreamento de origem",
      "Tags do Google Ads, GA4 e Meta instaladas",
      "Dados estruturados para aparecer melhor no Google",
    ],
    etapas: [
      { titulo: "Estrutura", texto: "Definimos páginas, mensagem e o caminho até o contato." },
      { titulo: "Texto e design", texto: "Escrevemos e desenhamos com foco em conversão." },
      { titulo: "Desenvolvimento", texto: "Construímos rápido, responsivo e com SEO técnico." },
      { titulo: "Medição", texto: "Instalamos as tags e ligamos o site ao CRM." },
    ],
    paraQuem: ["Empresas sem site ou com site antigo", "Campanhas que precisam de landing page", "Negócios que querem aparecer no Google", "Prestadores de serviço"],
    faq: [
      { pergunta: "Quanto tempo leva para fazer um site?", resposta: "Uma landing page fica pronta em poucos dias. Um site institucional completo leva algumas semanas, conforme o número de páginas." },
      { pergunta: "O site aparece no Google?", resposta: "Ele sai pronto para isso: rápido, com textos, dados estruturados e sitemap. Aparecer bem também depende de conteúdo e de tempo." },
      { pergunta: "Consigo editar depois?", resposta: "Sim. Combinamos como fica a edição de textos e imagens no seu caso." },
      { pergunta: "Vocês atendem empresas de outros estados?", resposta: "Sim. Site e landing page são feitos 100% online, para empresas de qualquer estado." },
    ],
  },
  {
    slug: "ecommerce",
    titulo: "Agência de e-commerce e loja virtual",
    metaTitulo: "Agência de E-commerce | Criação e Gestão de Loja Virtual · Yide",
    metaDescricao: "Criação e gestão de loja virtual: catálogo, checkout, tráfego e recuperação de vendas. Agência em Cuiabá que atende todo o Brasil.",
    resposta: "A Yide monta e gerencia sua loja virtual, do catálogo ao checkout, e traz tráfego para ela. Cuidamos dos produtos, das campanhas e da recuperação de carrinhos para a loja vender todo dia. Atendemos empresas de todo o Brasil, com reuniões por vídeo e a mesma equipe do começo ao fim.",
    entregas: [
      "Criação ou migração da loja virtual",
      "Cadastro e otimização de produtos e fotos",
      "Checkout, frete e meios de pagamento",
      "Anúncios de catálogo no Google e na Meta",
      "Recuperação de carrinho e remarketing",
      "Relatório de vendas, ticket médio e custo por venda",
    ],
    etapas: [
      { titulo: "Plataforma", texto: "Escolhemos ou ajustamos a plataforma certa para o seu volume." },
      { titulo: "Catálogo", texto: "Organizamos produtos, fotos, descrições e preços." },
      { titulo: "Tráfego", texto: "Ligamos anúncios de catálogo e remarketing." },
      { titulo: "Otimização", texto: "Acompanhamos conversão, carrinho e ticket médio." },
    ],
    paraQuem: ["Lojas físicas que querem vender online", "Marcas próprias", "Distribuidores e atacado", "Lojas que já vendem e querem escalar"],
    faq: [
      { pergunta: "Qual plataforma de loja virtual usar?", resposta: "Depende do volume e do tipo de produto. Indicamos a melhor opção no diagnóstico, considerando custos e integrações." },
      { pergunta: "Vocês cuidam dos anúncios da loja?", resposta: "Sim. Loja e tráfego andam juntos: anúncios de catálogo, Google Shopping e remarketing." },
      { pergunta: "Dá para integrar com marketplaces?", resposta: "Sim. A loja pode trabalhar junto com Mercado Livre, Shopee e Amazon." },
      { pergunta: "Vocês atendem empresas de outros estados?", resposta: "Sim. A loja virtual vende para o Brasil inteiro e atendemos lojistas de qualquer estado, com reuniões por vídeo e acompanhamento pelo sistema da Yide." },
    ],
  },
  {
    slug: "marketplaces",
    titulo: "Marketplaces: Mercado Livre, Shopee e Amazon",
    metaTitulo: "Agência de Mercado Livre, Shopee e Amazon | Yide Digital",
    metaDescricao: "Venda mais no Mercado Livre, Shopee e Amazon: cadastro, anúncios, reputação e Mercado Ads. Agência em Cuiabá que atende todo o Brasil.",
    resposta: "A Yide coloca e faz crescer sua empresa no Mercado Livre, na Shopee e na Amazon. Cuidamos do cadastro, dos títulos e fotos, da reputação e dos anúncios pagos dentro do marketplace. Atendemos empresas de todo o Brasil, com reuniões por vídeo e a mesma equipe do começo ao fim.",
    entregas: [
      "Abertura e configuração de conta nos marketplaces",
      "Cadastro de produtos com títulos e fichas otimizados para a busca",
      "Fotos e descrições que convertem",
      "Mercado Ads e anúncios patrocinados",
      "Gestão de reputação, perguntas e prazos",
      "Relatório de vendas, margem e custo de anúncio",
    ],
    etapas: [
      { titulo: "Análise", texto: "Estudamos concorrentes, preços e categorias dos seus produtos." },
      { titulo: "Cadastro", texto: "Publicamos produtos com títulos e fichas otimizados." },
      { titulo: "Anúncios", texto: "Ligamos Mercado Ads e patrocinados nos produtos com margem." },
      { titulo: "Reputação", texto: "Acompanhamos perguntas, prazos e avaliações para subir de nível." },
    ],
    paraQuem: ["Lojas que querem vender no Brasil todo", "Indústrias e distribuidores", "Marcas próprias", "Quem já vende e quer escalar no Mercado Livre"],
    faq: [
      { pergunta: "Vale a pena vender no Mercado Livre?", resposta: "Para a maioria dos produtos, sim: é onde está grande parte da busca de compra online no Brasil. O ponto é ter margem depois das taxas e do frete." },
      { pergunta: "O que é Mercado Ads?", resposta: "São os anúncios pagos dentro do Mercado Livre, que colocam seus produtos no topo da busca. Bem usados, aceleram vendas e reputação." },
      { pergunta: "Vocês atendem empresas de fora de Mato Grosso?", resposta: "Sim. Marketplace é nacional e atendemos empresas de todo o Brasil." },
    ],
  },
  {
    slug: "assessoria-de-marketing",
    titulo: "Assessoria de marketing e vendas",
    metaTitulo: "Assessoria de Marketing e Vendas para Empresas | Yide Digital",
    metaDescricao: "Assessoria de marketing e vendas para empresas que querem crescer com método: planejamento, acompanhamento e metas. Cuiabá e todo o Brasil.",
    resposta: "A assessoria da Yide junta marketing e vendas num plano só, com metas, rotina e acompanhamento. Você tem uma equipe que pensa o crescimento da empresa e cuida da execução de anúncios, conteúdo, atendimento e CRM. Atendemos empresas de todo o Brasil, com reuniões por vídeo e a mesma equipe do começo ao fim.",
    entregas: [
      "Diagnóstico de marketing e do processo comercial",
      "Plano com metas, canais e verba",
      "Execução integrada: tráfego, conteúdo, site e CRM",
      "Treinamento do time de vendas no atendimento pelo WhatsApp",
      "Reuniões de acompanhamento e relatório mensal",
      "Acompanhamento 24h pelo sistema da Yide",
    ],
    etapas: [
      { titulo: "Diagnóstico", texto: "Olhamos números, canais, atendimento e concorrência." },
      { titulo: "Plano", texto: "Definimos metas, prioridades e o que entra em cada mês." },
      { titulo: "Execução", texto: "A equipe da Yide põe o plano para rodar." },
      { titulo: "Revisão", texto: "Todo mês revisamos números e ajustamos o plano." },
    ],
    paraQuem: ["Empresas que querem crescer com método", "Negócios sem time de marketing", "Empresas com time comercial", "Franquias e redes locais"],
    faq: [
      { pergunta: "Qual a diferença entre assessoria e contratar só tráfego?", resposta: "Na assessoria cuidamos do caminho inteiro: anúncio, conteúdo, site, atendimento e CRM. O tráfego sozinho cuida só de trazer o contato." },
      { pergunta: "Como funciona o acompanhamento?", resposta: "Você acompanha tudo pelo sistema da Yide e tem reuniões de resultado com a equipe." },
      { pergunta: "Tem contrato de fidelidade?", resposta: "As condições são combinadas no diagnóstico, conforme o escopo do projeto." },
      { pergunta: "Vocês atendem empresas de outros estados?", resposta: "Sim. A assessoria funciona por reuniões de vídeo e pelo sistema da Yide, onde você acompanha tudo em tempo real." },
    ],
  },
  {
    slug: "seo-google",
    titulo: "SEO e Perfil da Empresa no Google",
    metaTitulo: "SEO e GEO: Apareça no Google, no Maps e nas IAs | Yide Digital",
    metaDescricao: "Apareça no Google, no Maps e nas respostas de IA: SEO, Perfil da Empresa, avaliações e conteúdo. Agência em Cuiabá que atende todo o Brasil.",
    resposta: "A Yide faz sua empresa aparecer no Google, no Maps e nas respostas de IA como ChatGPT e Gemini. Cuidamos do Perfil da Empresa no Google, das avaliações, do site e do conteúdo que responde o que seu cliente pergunta. Atendemos empresas de todo o Brasil, com reuniões por vídeo e a mesma equipe do começo ao fim.",
    entregas: [
      "Otimização do Perfil da Empresa no Google (Maps)",
      "Estratégia para conseguir mais avaliações",
      "SEO técnico do site: velocidade, sitemap e dados estruturados",
      "Conteúdo que responde às buscas reais do seu público",
      "Presença nas respostas de IA (GEO)",
      "Relatório de posições, cliques e contatos vindos do Google",
    ],
    etapas: [
      { titulo: "Auditoria", texto: "Avaliamos site, Perfil da Empresa, avaliações e concorrentes." },
      { titulo: "Correções", texto: "Ajustamos o técnico do site e completamos o perfil." },
      { titulo: "Conteúdo", texto: "Publicamos páginas e artigos para as buscas que trazem cliente." },
      { titulo: "Acompanhamento", texto: "Medimos posições e contatos e reforçamos o que funciona." },
    ],
    paraQuem: ["Negócios locais que dependem do Maps", "Empresas com site que não aparece", "Prestadores de serviço", "Quem quer depender menos de anúncio"],
    faq: [
      { pergunta: "Quanto tempo leva para aparecer no Google?", resposta: "No Maps, ajustes no perfil e novas avaliações têm efeito em semanas. No site, o SEO costuma mostrar resultado consistente em alguns meses." },
      { pergunta: "O que é GEO?", resposta: "É o trabalho para sua empresa ser citada nas respostas de IA, como ChatGPT, Gemini e o resumo de IA do Google. Envolve conteúdo claro, dados estruturados e menções em outros sites." },
      { pergunta: "Avaliações ajudam no Google?", resposta: "Sim. Quantidade, nota e texto das avaliações pesam no Maps e na escolha do cliente." },
      { pergunta: "Vocês atendem empresas de outros estados?", resposta: "Sim. SEO, Perfil da Empresa e presença nas IAs são trabalhados a distância para empresas de todo o Brasil." },
    ],
  },
  {
    slug: "delivery-ifood",
    titulo: "Gestão de iFood e delivery",
    metaTitulo: "Gestão de iFood e Delivery para Restaurantes | Yide Digital",
    metaDescricao: "Gestão de iFood e delivery próprio: cardápio, fotos, ranking no app, anúncios na hora da fome e pedidos no WhatsApp. Agência em Cuiabá.",
    resposta: "A Yide cuida do delivery do seu restaurante dentro e fora do iFood. Organizamos cardápio, fotos e combos para subir no ranking do app, e montamos o delivery próprio pelo WhatsApp com anúncios na hora da fome, para você depender menos da taxa do aplicativo. Atendemos empresas de todo o Brasil, com reuniões por vídeo e a mesma equipe do começo ao fim.",
    entregas: [
      "Revisão do cardápio, combos e preços no iFood",
      "Fotos e vídeos de produto pensados para o celular",
      "Campanhas e promoções dentro do iFood",
      "Delivery próprio pelo WhatsApp com cardápio digital",
      "Anúncios no Instagram e no Google nos horários e bairros que mais pedem",
      "CRM para responder rápido e chamar de volta quem já pediu",
    ],
    etapas: [
      { titulo: "Diagnóstico", texto: "Olhamos ranking, avaliações, cardápio e o custo das taxas no app." },
      { titulo: "Cardápio e fotos", texto: "Ajustamos combos, preços e imagens para vender mais por pedido." },
      { titulo: "Canal próprio", texto: "Ligamos o WhatsApp com anúncio na hora da fome e cardápio digital." },
      { titulo: "Recompra", texto: "Chamamos de volta quem já pediu, com oferta no dia certo." },
    ],
    paraQuem: ["Restaurantes e lanchonetes", "Pizzarias e hamburguerias", "Sushi, poke e açaí", "Dark kitchens e marcas novas no delivery"],
    faq: [
      { pergunta: "Vale a pena sair do iFood?", resposta: "Não é preciso sair. O iFood traz cliente novo; o delivery próprio pelo WhatsApp traz a recompra sem taxa. O ideal é usar os dois juntos." },
      { pergunta: "Como subir no ranking do iFood?", resposta: "Ranking depende de avaliação, tempo de entrega, taxa de conversão do cardápio e participação em campanhas. Trabalhamos cada um desses pontos." },
      { pergunta: "Vocês fazem as fotos dos pratos?", resposta: "Sim. A Yide tem estúdio e equipe de audiovisual, e também grava no seu restaurante." },
      { pergunta: "Vocês atendem empresas de outros estados?", resposta: "Sim. O trabalho no iFood e no delivery próprio é feito a distância, para restaurantes de qualquer cidade. As fotos podem ser feitas por um fotógrafo local seguindo o nosso roteiro." },
    ],
  },
  {
    slug: "fotos-e-video-para-eventos",
    titulo: "Fotos e vídeo para eventos em Cuiabá",
    precoProprio: "Orçamento sob medida pelo WhatsApp, conforme a duração e o tamanho do evento.",
    metaTitulo: "Fotos e Vídeo para Eventos em Cuiabá | Yide Digital",
    metaDescricao: "Cobertura de fotos e vídeo para eventos corporativos, inaugurações, lançamentos e confraternizações em Cuiabá, com entrega rápida para as redes.",
    resposta: "A Yide faz a cobertura de fotos e vídeo do seu evento em Cuiabá e Várzea Grande: inaugurações, lançamentos, palestras, feiras e confraternizações de empresa. Além das fotos e do vídeo completo, entregamos stories e reels prontos para postar ainda no dia, porque evento bom é o que continua vendendo depois que acaba.",
    entregas: [
      "Fotógrafo e videomaker no local, com equipamento profissional",
      "Fotos tratadas em alta resolução, em galeria online para baixar",
      "Vídeo resumo (aftermovie) do evento",
      "Stories e reels editados para postar no mesmo dia",
      "Depoimentos curtos de convidados, palestrantes e clientes",
      "Cortes do evento para usar em anúncios e no site",
    ],
    etapas: [
      { titulo: "Briefing", texto: "Entendemos o objetivo do evento, o roteiro do dia e os momentos que não podem faltar." },
      { titulo: "Cobertura", texto: "Fotografamos e filmamos o evento, com captação de stories ao vivo se você quiser." },
      { titulo: "Edição", texto: "Tratamos as fotos e editamos o vídeo resumo, os reels e os cortes." },
      { titulo: "Entrega e divulgação", texto: "Entregamos tudo em galeria online e, se quiser, o melhor material vira post e anúncio." },
    ],
    paraQuem: [
      "Empresas com inaugurações e lançamentos",
      "Palestras, workshops e eventos de associação",
      "Feiras, estandes e ativações de marca",
      "Confraternizações e festas de fim de ano de empresa",
    ],
    faq: [
      { pergunta: "Vocês cobrem eventos em Cuiabá e Várzea Grande?", resposta: "Sim. A equipe de audiovisual da Yide fica em Cuiabá e vai até o local do evento. Para outras cidades de Mato Grosso, combinamos o deslocamento no orçamento." },
      { pergunta: "Em quanto tempo recebo as fotos e o vídeo?", resposta: "Stories e uma prévia das fotos podem sair no mesmo dia. A galeria completa e o vídeo resumo são entregues em poucos dias, com o prazo combinado no orçamento conforme o tamanho do evento." },
      { pergunta: "Quanto custa a cobertura de um evento?", resposta: "Depende da duração, do número de profissionais e do que você quer receber (só fotos, fotos e vídeo, stories ao vivo). Fazemos o orçamento pelo WhatsApp a partir do roteiro do evento." },
      { pergunta: "Dá para usar o material em anúncios?", resposta: "Sim. Além do vídeo resumo, editamos cortes curtos pensados para anúncio e para as redes, e a Yide também pode cuidar da divulgação." },
    ],
  },
];

export function conteudoDoServico(slug: string): ConteudoServico | null {
  return CONTEUDO_SERVICOS.find((c) => c.slug === slug) ?? null;
}
