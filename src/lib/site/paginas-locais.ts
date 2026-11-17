// Páginas serviço × cidade escritas à mão. Cada uma tem contexto próprio da praça (não é
// modelo trocando o nome da cidade), para não virar "doorway page". Só as combinações
// listadas aqui são indexadas; as demais cidades entram pela página do estado e pela
// personalização dos anúncios.
import type { Pergunta } from "./servicos-conteudo";

export interface PaginaLocal {
  servico: string;
  cidade: string;
  titulo: string;
  metaTitulo: string;
  metaDescricao: string;
  resposta: string;
  contexto: string[];
  focos: string[];
  faq: Pergunta[];
}

export const PAGINAS_LOCAIS: PaginaLocal[] = [
  // ---------------------------------------------------------------- Tráfego pago
  {
    servico: "gestao-de-trafego",
    cidade: "cuiaba",
    titulo: "Gestão de tráfego pago em Cuiabá",
    metaTitulo: "Gestão de Tráfego Pago em Cuiabá | Google e Meta Ads · Yide",
    metaDescricao: "Agência de tráfego pago em Cuiabá: anúncios no Google, Instagram e Facebook que trazem conversas no WhatsApp. Sede no Jardim das Américas.",
    resposta: "A Yide é uma agência de tráfego pago com sede em Cuiabá, no Jardim das Américas. Criamos e acompanhamos anúncios no Google, no Instagram e no Facebook para empresas da capital, com foco em conversas no WhatsApp e no custo de cada cliente, não em curtidas.",
    contexto: [
      "Em Cuiabá a disputa por atenção é concentrada: muita gente pesquisa e compra em poucos raios, como Centro, Goiabeiras, Jardim das Américas e Coxipó. Por isso a segmentação por bairro e por distância da loja pesa tanto quanto a criatividade do anúncio. Um restaurante no Bosque da Saúde não precisa pagar para aparecer para quem mora no CPA.",
      "Também levamos em conta o calendário local. O calor muda o horário de pico de compra, e datas como o aniversário da cidade e a temporada de fim de ano mexem no custo do clique. Ajustamos verba e horários com base no histórico de cada conta, sem copiar receita de outro estado.",
    ],
    focos: [
      "Anúncios com raio por bairro ou distância da sua loja",
      "Campanhas de Pesquisa no Google para quem já procura o serviço em Cuiabá",
      "Instagram e Facebook com ofertas para o público da capital",
      "Medição de conversas no WhatsApp pelo CRM Lyide",
    ],
    faq: [
      { pergunta: "Quanto custa tráfego pago em Cuiabá?", resposta: "Há duas partes: a gestão da Yide e a verba paga ao Google e à Meta. A gestão começa a partir de R$ 1.000. Para negócios locais da capital, é comum começar com R$ 20 a R$ 50 por dia de verba. No diagnóstico gratuito indicamos o valor para o seu caso." },
      { pergunta: "A Yide faz reunião presencial em Cuiabá?", resposta: "Sim. A sede fica no Jardim das Américas e também vamos até a sua empresa para reuniões e gravações." },
      { pergunta: "Dá para anunciar só para alguns bairros de Cuiabá?", resposta: "Sim. Dá para limitar os anúncios por bairro, por raio a partir da loja ou por região, o que costuma baixar o custo por cliente em negócios de atendimento local." },
    ],
  },
  {
    servico: "gestao-de-trafego",
    cidade: "varzea-grande",
    titulo: "Gestão de tráfego pago em Várzea Grande",
    metaTitulo: "Tráfego Pago em Várzea Grande | Anúncios Google e Meta · Yide",
    metaDescricao: "Anúncios no Google, Instagram e Facebook para empresas de Várzea Grande que querem mais clientes no WhatsApp. Atendimento presencial, a Yide fica ao lado.",
    resposta: "A Yide faz a gestão de tráfego pago para empresas de Várzea Grande, com anúncios no Google, no Instagram e no Facebook. Ficamos a poucos minutos, do outro lado da ponte, e montamos campanhas para quem vende no bairro e para quem atende toda a região metropolitana.",
    contexto: [
      "Várzea Grande tem um perfil próprio: muito comércio de bairro, distribuidoras, oficinas e empresas de logística por causa do aeroporto e das saídas para o interior. Parte dos clientes mora na própria cidade e parte vem de Cuiabá. Por isso decidimos com você se a campanha fica só em Várzea Grande ou cobre a região toda.",
      "Para quem vende para outras empresas, como atacado e distribuição, a pesquisa no Google costuma trazer contatos mais qualificados que o Instagram. Para o comércio de bairro, anúncios com raio pequeno e oferta clara funcionam melhor. A estratégia muda conforme o negócio.",
    ],
    focos: [
      "Raio de anúncio por bairro, como Cristo Rei, Jardim Glória e Centro",
      "Campanhas para atacado e distribuição no Google",
      "Ofertas locais no Instagram e no Facebook",
      "Relatório de custo por conversa e por venda",
    ],
    faq: [
      { pergunta: "Vocês atendem empresas de Várzea Grande?", resposta: "Sim. Atendemos presencialmente em Várzea Grande, além do acompanhamento online e 24 horas pelo sistema da Yide." },
      { pergunta: "Vale anunciar também para Cuiabá?", resposta: "Depende do negócio. Se o cliente atravessa a ponte para comprar de você, vale. Se o atendimento é de bairro, concentrar em Várzea Grande sai mais barato." },
      { pergunta: "Tráfego pago funciona para atacado e distribuidora?", resposta: "Sim. Campanhas de Pesquisa no Google pegam compradores que procuram fornecedor, e o CRM organiza os pedidos que chegam pelo WhatsApp." },
    ],
  },
  {
    servico: "gestao-de-trafego",
    cidade: "salvador",
    titulo: "Gestão de tráfego pago em Salvador",
    metaTitulo: "Gestão de Tráfego Pago em Salvador | Google e Meta Ads · Yide",
    metaDescricao: "Gestão de anúncios no Google, Instagram e Facebook para empresas de Salvador, com foco em conversas no WhatsApp e custo por cliente.",
    resposta: "A Yide cuida dos anúncios de empresas de Salvador no Google, no Instagram e no Facebook, com acompanhamento online e relatório de quanto custa cada conversa e cada venda. O foco é trazer cliente pelo WhatsApp, não só visualização.",
    contexto: [
      "Salvador é uma cidade grande e espalhada, com públicos muito diferentes entre a orla, como Barra e Rio Vermelho, a região da Pituba e do Itaigara e o eixo da Paralela. Segmentar por região evita pagar por cliques de quem nunca vai até você.",
      "Turismo e gastronomia têm sazonalidade forte na cidade, com alta no verão e no Carnaval. Para esses negócios planejamos a verba por temporada; para clínicas, serviços e varejo, o ritmo é mais estável ao longo do ano.",
    ],
    focos: [
      "Segmentação por região: orla, Pituba e Itaigara, Paralela",
      "Planejamento de verba por temporada para turismo e gastronomia",
      "Campanhas de Pesquisa para quem procura o serviço",
      "Atendimento online com acompanhamento 24 horas",
    ],
    faq: [
      { pergunta: "A Yide atende empresas de Salvador?", resposta: "Sim. O atendimento é online, com reuniões por vídeo e acompanhamento pelo sistema da Yide. Gravações locais são combinadas no diagnóstico." },
      { pergunta: "Como fica o investimento na alta temporada?", resposta: "Aumentamos a verba de forma gradual antes do pico e reduzimos depois, para não pagar caro pelo clique quando a concorrência dispara." },
      { pergunta: "Vocês trabalham com negócios de turismo?", resposta: "Sim. Pousadas, passeios e restaurantes se beneficiam de anúncios por temporada e de atendimento rápido no WhatsApp." },
    ],
  },
  {
    servico: "gestao-de-trafego",
    cidade: "mato-grosso",
    titulo: "Gestão de tráfego pago em Mato Grosso",
    metaTitulo: "Gestão de Tráfego Pago em Mato Grosso | Agência Yide",
    metaDescricao: "Anúncios no Google e na Meta para empresas de todo o Mato Grosso: Rondonópolis, Sinop, Sorriso, Lucas, Tangará e mais. Agência com sede em Cuiabá.",
    resposta: "A Yide é uma agência de Cuiabá que faz gestão de tráfego pago para empresas de todo o Mato Grosso, de Rondonópolis a Sinop. Montamos campanhas no Google e na Meta pensadas para cidades do interior, onde o público é menor e cada cliente vale mais.",
    contexto: [
      "No interior de Mato Grosso a economia gira em torno do agronegócio, e isso muda o calendário de venda. Revendas, concessionárias e lojas sentem o ciclo de plantio e de colheita de soja, milho e algodão. Planejamos as campanhas acompanhando essas janelas.",
      "Em cidades como Sorriso, Lucas do Rio Verde e Primavera do Leste o público é menor que na capital, então o anúncio precisa ser mais certeiro e o atendimento mais rápido. Segmentamos por cidade e por raio e ligamos tudo ao CRM para não perder nenhum contato.",
    ],
    focos: [
      "Campanhas por cidade do interior, com raio ao redor da loja",
      "Calendário alinhado à safra para revendas e concessionárias",
      "Google para quem procura fornecedor e Instagram para varejo",
      "Reuniões por vídeo e visitas programadas",
    ],
    faq: [
      { pergunta: "A Yide atende cidades do interior de MT?", resposta: "Sim. Atendemos empresas de todo o estado com reuniões online e visitas programadas para planejamento e gravação." },
      { pergunta: "Tráfego pago funciona em cidade pequena?", resposta: "Funciona, com ajustes: o público é menor, então o anúncio precisa de segmentação certa e de atendimento rápido para cada contato virar venda." },
      { pergunta: "Vocês atendem empresas do agronegócio?", resposta: "Sim. Revendas, concessionárias de máquinas e empresas ligadas ao agro estão entre os segmentos que atendemos, com campanhas que acompanham a safra." },
    ],
  },

  // ---------------------------------------------------------------- CRM com IA
  {
    servico: "crm-ia-dados",
    cidade: "cuiaba",
    titulo: "CRM com IA para WhatsApp em Cuiabá",
    metaTitulo: "CRM com IA para WhatsApp em Cuiabá | Lyide by Yide",
    metaDescricao: "Lyide, o CRM com IA da Yide: responde seus clientes no WhatsApp em segundos e organiza as vendas. Implantação presencial em Cuiabá.",
    resposta: "O Lyide é o CRM com inteligência artificial desenvolvido pela Yide, em Cuiabá, para empresas que vendem pelo WhatsApp. A IA responde cada contato em segundos, organiza o funil e mostra qual anúncio trouxe cada venda. Em Cuiabá a implantação é feita presencialmente pela equipe da Yide.",
    contexto: [
      "Boa parte do comércio de Cuiabá vende pelo WhatsApp: lojas, clínicas, restaurantes e prestadores de serviço. O gargalo costuma ser o mesmo, mensagem que demora a ser respondida e cliente que fecha com o concorrente. A IA do Lyide atende na hora, inclusive à noite e no fim de semana.",
      "Como o sistema é da própria Yide, o treinamento da equipe e o ajuste da IA acontecem aqui em Cuiabá, na sua empresa ou na sede no Jardim das Américas, com acompanhamento nas primeiras semanas.",
    ],
    focos: [
      "Implantação presencial na sua empresa em Cuiabá",
      "IA treinada com seus produtos, preços e horários",
      "Vários atendentes no mesmo número de WhatsApp",
      "Relatório de vendas por anúncio e por vendedor",
    ],
    faq: [
      { pergunta: "O Lyide é de Cuiabá?", resposta: "Sim. O Lyide é desenvolvido pela Yide, que tem sede em Cuiabá, e o suporte é feito pela mesma equipe." },
      { pergunta: "A implantação é presencial?", resposta: "Em Cuiabá, sim. Configuramos o WhatsApp, o funil e treinamos sua equipe no local." },
      { pergunta: "A IA responde fora do horário comercial?", resposta: "Sim. Ela responde 24 horas, tira as dúvidas comuns e deixa o lead pronto para o vendedor no dia seguinte." },
    ],
  },
  {
    servico: "crm-ia-dados",
    cidade: "varzea-grande",
    titulo: "CRM com IA para WhatsApp em Várzea Grande",
    metaTitulo: "CRM com IA para WhatsApp em Várzea Grande | Lyide",
    metaDescricao: "CRM com IA para empresas de Várzea Grande que vendem pelo WhatsApp: respostas em segundos, funil organizado e pedidos sem se perder.",
    resposta: "O Lyide, CRM com inteligência artificial da Yide, ajuda empresas de Várzea Grande a responder clientes no WhatsApp em segundos e a não perder pedido. A implantação é presencial, com a equipe da Yide indo até a sua empresa.",
    contexto: [
      "Em Várzea Grande muitas empresas recebem pedidos pelo WhatsApp o dia inteiro: distribuidoras, autopeças, alimentação e serviços. Quando várias pessoas usam o mesmo celular, a conversa se perde e o cliente fica sem resposta. O Lyide coloca todos os atendentes no mesmo número, com cada conversa no lugar certo.",
      "Para distribuidoras e atacado, o funil do Lyide acompanha o pedido do primeiro contato até a entrega e lembra o vendedor de voltar a falar com quem sumiu.",
    ],
    focos: [
      "Vários vendedores no mesmo número",
      "Follow-up automático de orçamento parado",
      "IA que responde preço, prazo e horário",
      "Implantação presencial em Várzea Grande",
    ],
    faq: [
      { pergunta: "Serve para distribuidora e atacado?", resposta: "Sim. O funil acompanha orçamento e pedido, e o follow-up automático lembra o vendedor de retomar quem não respondeu." },
      { pergunta: "Precisa trocar de número?", resposta: "Não. O Lyide funciona com o número de WhatsApp que a empresa já usa." },
      { pergunta: "Vocês vão até Várzea Grande?", resposta: "Sim. A implantação e o treinamento são feitos na sua empresa." },
    ],
  },
  {
    servico: "crm-ia-dados",
    cidade: "salvador",
    titulo: "CRM com IA para WhatsApp em Salvador",
    metaTitulo: "CRM com IA para WhatsApp em Salvador | Lyide by Yide",
    metaDescricao: "CRM com IA para empresas de Salvador: atendimento no WhatsApp em segundos, 24 horas, com funil de vendas e relatórios. Implantação online.",
    resposta: "O Lyide é o CRM com inteligência artificial da Yide para empresas de Salvador que atendem pelo WhatsApp. A IA responde em segundos, 24 horas por dia, e o painel mostra o funil de vendas e a origem de cada cliente. A implantação é feita online, com acompanhamento da equipe da Yide.",
    contexto: [
      "Em negócios de turismo, gastronomia e saúde de Salvador, o volume de mensagens cresce muito na alta temporada, justamente quando a equipe está mais ocupada. A IA do Lyide segura o primeiro atendimento, responde as perguntas repetidas e passa para a equipe só quem está pronto para fechar.",
      "Toda a configuração é feita por videochamada: conectamos o WhatsApp, treinamos a IA com seus serviços e preços e acompanhamos as conversas nas primeiras semanas.",
    ],
    focos: [
      "Atendimento 24 horas na alta temporada",
      "Respostas automáticas para dúvidas repetidas",
      "Implantação e treinamento online",
      "Origem de cada cliente: anúncio, Instagram ou Google",
    ],
    faq: [
      { pergunta: "Funciona para pousadas e restaurantes?", resposta: "Sim. A IA responde disponibilidade, horários, cardápio e preços, e passa reservas e pedidos para a equipe." },
      { pergunta: "Como é a implantação a distância?", resposta: "Por videochamada: configuramos o sistema, treinamos a IA e a equipe e acompanhamos as conversas no início." },
      { pergunta: "Tem suporte depois?", resposta: "Sim. O suporte é feito pela equipe da Yide, com acompanhamento pelo sistema." },
    ],
  },
  {
    servico: "crm-ia-dados",
    cidade: "mato-grosso",
    titulo: "CRM com IA para WhatsApp em Mato Grosso",
    metaTitulo: "CRM com IA para WhatsApp em Mato Grosso | Lyide by Yide",
    metaDescricao: "CRM com IA para empresas do interior de MT: revendas, concessionárias e varejo atendendo no WhatsApp em segundos. Sistema criado em Cuiabá.",
    resposta: "O Lyide, CRM com inteligência artificial criado pela Yide em Cuiabá, atende empresas de todo o Mato Grosso que vendem pelo WhatsApp. Revendas agrícolas, concessionárias e o varejo do interior respondem clientes em segundos e acompanham cada negociação até a venda.",
    contexto: [
      "No interior, uma venda de máquina, insumo ou veículo pode levar semanas, com muitas conversas no caminho. O Lyide registra todo o histórico, lembra o vendedor de retomar o contato e mostra em que etapa está cada negociação, mesmo com a equipe na estrada.",
      "A implantação é online, com visitas programadas quando o projeto pede. O sistema funciona no celular, o que ajuda vendedores que passam o dia em campo.",
    ],
    focos: [
      "Histórico completo de negociações longas",
      "Lembretes de follow-up para vendedor externo",
      "Uso pelo celular, em campo",
      "Implantação online com visitas programadas",
    ],
    faq: [
      { pergunta: "Serve para revendas agrícolas e concessionárias?", resposta: "Sim. Negociações longas ficam organizadas no funil, com histórico e lembretes para o vendedor." },
      { pergunta: "Funciona no celular?", resposta: "Sim. O vendedor acompanha os contatos e responde pelo celular, inclusive em campo." },
      { pergunta: "Atendem cidades longe de Cuiabá?", resposta: "Sim. A implantação é online e fazemos visitas programadas quando necessário." },
    ],
  },

  // ---------------------------------------------------------------- Redes sociais
  {
    servico: "redes-sociais",
    cidade: "cuiaba",
    titulo: "Gestão de redes sociais em Cuiabá",
    metaTitulo: "Social Media em Cuiabá | Gestão de Instagram · Yide Digital",
    metaDescricao: "Gestão de Instagram e redes sociais em Cuiabá, com conteúdo, vídeos gravados na sua empresa e foco em gerar conversas e vendas.",
    resposta: "A Yide faz a gestão das redes sociais de empresas de Cuiabá, do planejamento à publicação, com vídeos gravados na sua empresa pela nossa equipe. O objetivo é o Instagram trazer conversas e vendas, não só seguidores.",
    contexto: [
      "Conteúdo local vende mais em Cuiabá. Mostrar a fachada, a equipe, o bairro e os clientes da cidade gera identificação e confiança. Como estamos na capital, gravamos na sua empresa com frequência, em vez de depender de imagem de banco.",
      "Planejamos o calendário com as datas que movem o comércio da cidade e integramos o conteúdo aos anúncios, para os melhores posts virarem campanha.",
    ],
    focos: [
      "Gravações recorrentes na sua empresa em Cuiabá",
      "Calendário com datas do comércio local",
      "Reels, carrosséis e stories com chamada para o WhatsApp",
      "Melhores posts transformados em anúncio",
    ],
    faq: [
      { pergunta: "Vocês gravam na minha empresa em Cuiabá?", resposta: "Sim. A equipe de audiovisual da Yide vai até você para gravar o conteúdo do mês." },
      { pergunta: "Quem aprova os posts?", resposta: "Você aprova o calendário e as peças pelo sistema antes de publicar." },
      { pergunta: "Social media e tráfego juntos fazem diferença?", resposta: "Sim. O conteúdo que engaja vira anúncio, e o anúncio leva gente para um perfil bem cuidado." },
    ],
  },
  {
    servico: "redes-sociais",
    cidade: "varzea-grande",
    titulo: "Gestão de redes sociais em Várzea Grande",
    metaTitulo: "Social Media em Várzea Grande | Gestão de Instagram · Yide",
    metaDescricao: "Gestão de Instagram para empresas de Várzea Grande: conteúdo com a cara da sua empresa, gravações no local e foco em clientes no WhatsApp.",
    resposta: "A Yide cuida do Instagram e das redes sociais de empresas de Várzea Grande, com conteúdo gravado no seu espaço e chamada para o WhatsApp em cada publicação. Estamos ao lado, em Cuiabá, e gravamos aí com frequência.",
    contexto: [
      "Muitas empresas de Várzea Grande têm clientes fiéis no bairro, mas aparecem pouco nas redes. Mostrar o dia a dia, a equipe e os produtos reais aproxima quem mora perto e ajuda a atrair clientes de Cuiabá.",
      "Para distribuidoras e indústria, o conteúdo muda: bastidores da operação, entregas, catálogo e depoimento de clientes que compram em volume.",
    ],
    focos: [
      "Conteúdo que mostra a empresa real",
      "Gravações no local em Várzea Grande",
      "Catálogo e bastidores para atacado e indústria",
      "Chamada para o WhatsApp em cada post",
    ],
    faq: [
      { pergunta: "Atendem empresas de Várzea Grande?", resposta: "Sim. Planejamos online e gravamos presencialmente no seu espaço." },
      { pergunta: "Serve para distribuidora?", resposta: "Sim. O conteúdo mostra operação, catálogo e clientes, e leva os contatos para o WhatsApp." },
      { pergunta: "Quantas publicações por semana?", resposta: "Depende do plano. Priorizamos constância e vídeos curtos, que hoje têm mais alcance." },
    ],
  },
  {
    servico: "redes-sociais",
    cidade: "salvador",
    titulo: "Gestão de redes sociais em Salvador",
    metaTitulo: "Social Media em Salvador | Gestão de Instagram · Yide Digital",
    metaDescricao: "Gestão de Instagram para empresas de Salvador, com planejamento, criação e publicação focados em gerar conversas e vendas.",
    resposta: "A Yide faz a gestão de redes sociais de empresas de Salvador, com planejamento mensal, criação de posts, reels e stories e publicação pelo sistema da Yide. Cada conteúdo termina com uma chamada clara para o WhatsApp.",
    contexto: [
      "Salvador tem uma cultura visual forte, e o público responde a conteúdo com identidade local. Planejamos com você a linguagem, as datas da cidade e as referências que fazem sentido para o seu público.",
      "O trabalho é online: você envia materiais e aprova tudo pelo sistema, e combinamos gravações locais quando o projeto pede vídeo profissional.",
    ],
    focos: [
      "Linguagem e datas da cidade no calendário",
      "Planejamento e aprovação pelo sistema",
      "Reels e stories com chamada para o WhatsApp",
      "Gravações locais quando o projeto pede",
    ],
    faq: [
      { pergunta: "Atendem empresas de Salvador a distância?", resposta: "Sim. Planejamento, criação e aprovação são online, com acompanhamento pelo sistema da Yide." },
      { pergunta: "E se eu precisar de vídeo profissional?", resposta: "Combinamos gravações locais no diagnóstico, conforme o plano." },
      { pergunta: "Vocês também cuidam dos anúncios?", resposta: "Sim. Redes sociais e tráfego pago podem andar juntos, com os melhores posts virando campanha." },
    ],
  },
  {
    servico: "redes-sociais",
    cidade: "mato-grosso",
    titulo: "Gestão de redes sociais em Mato Grosso",
    metaTitulo: "Social Media em Mato Grosso | Gestão de Instagram · Yide",
    metaDescricao: "Gestão de Instagram para empresas do interior de Mato Grosso: conteúdo do agro e do varejo regional, com foco em clientes no WhatsApp.",
    resposta: "A Yide gerencia as redes sociais de empresas de todo o Mato Grosso, do planejamento à publicação. Para o interior, criamos conteúdo que conversa com o público da cidade, do agronegócio ao varejo regional, sempre levando para o WhatsApp.",
    contexto: [
      "Em cidades como Sinop, Sorriso e Rondonópolis, empresa conhecida é empresa lembrada. Mostrar equipe, estrutura, clientes da região e o dia a dia no campo constrói essa reputação nas redes.",
      "O planejamento é online, com envio de materiais pela equipe da sua empresa e visitas programadas para gravar conteúdos maiores, como depoimentos e vídeos institucionais.",
    ],
    focos: [
      "Conteúdo do agro e do varejo regional",
      "Depoimentos de clientes da sua cidade",
      "Planejamento online e visitas para gravação",
      "Integração com anúncios no interior",
    ],
    faq: [
      { pergunta: "Funciona para empresa do agro?", resposta: "Sim. Revendas, concessionárias e agroindústrias ganham autoridade mostrando estrutura, equipe e clientes." },
      { pergunta: "Como é feito a distância?", resposta: "Planejamos e aprovamos online, e marcamos visitas para gravar quando o projeto pede." },
      { pergunta: "Atendem qualquer cidade de MT?", resposta: "Sim. Atendemos empresas de todo o estado." },
    ],
  },
  // ---------------------------------------------------------------- E-commerce, marketplace e delivery
  {
    servico: "ecommerce",
    cidade: "cuiaba",
    titulo: "Agência de e-commerce e loja virtual em Cuiabá",
    metaTitulo: "Agência de E-commerce em Cuiabá | Loja Virtual · Yide Digital",
    metaDescricao: "Agência de e-commerce em Cuiabá: criação e gestão de loja virtual, catálogo, checkout, anúncios e recuperação de carrinho. Sede no Jardim das Américas.",
    resposta: "A Yide é uma agência de e-commerce com sede em Cuiabá, no Jardim das Américas. Montamos e cuidamos da loja virtual de empresas da capital, do cadastro dos produtos ao checkout, e trazemos tráfego para ela, para a loja física passar a vender para Mato Grosso e para o resto do Brasil.",
    contexto: [
      "Muita loja de Cuiabá já vende bem no balcão e no WhatsApp, mas depende de quem passa na porta ou chama no direct. A loja virtual abre o catálogo para o interior do estado, onde o cliente muitas vezes não tem a mesma variedade, e para outros estados, onde o frete a partir de Cuiabá é competitivo para muitos segmentos.",
      "Por isso o trabalho começa pelo que já vende na loja física: os produtos campeões viram as primeiras vitrines, com foto e descrição pensadas para a busca. Depois entram anúncios de catálogo e remarketing para quem visitou a loja e não comprou. Temos time de e-commerce e estúdio na sede para produzir as fotos.",
    ],
    focos: [
      "Criação ou migração da loja virtual na plataforma certa",
      "Cadastro de produtos com fotos feitas no nosso estúdio em Cuiabá",
      "Frete e retirada na loja para clientes da capital",
      "Anúncios de catálogo e remarketing no Google e na Meta",
    ],
    faq: [
      { pergunta: "Vale a pena ter loja virtual tendo loja física em Cuiabá?", resposta: "Sim, quando o catálogo é bom e o frete fecha a conta. A loja virtual vende para o interior de MT e para outros estados, e também serve de vitrine para quem é da capital e prefere ver antes de ir até a loja." },
      { pergunta: "Quanto custa a gestão de e-commerce?", resposta: "Os planos da Yide começam em R$ 1.000 por mês, e a verba de anúncios é à parte. No diagnóstico gratuito indicamos o formato para o tamanho do seu catálogo." },
      { pergunta: "Dá para vender também no Mercado Livre e na Shopee?", resposta: "Sim. A loja virtual pode andar junto com os marketplaces, com estoque e preços organizados nos dois canais." },
    ],
  },
  {
    servico: "marketplaces",
    cidade: "cuiaba",
    titulo: "Gestão de Mercado Livre e Shopee em Cuiabá",
    metaTitulo: "Gestão de Mercado Livre e Shopee em Cuiabá · Yide Digital",
    metaDescricao: "Agência de marketplace em Cuiabá: Mercado Livre, Shopee e Amazon, com cadastro, anúncios, reputação e Mercado Ads. Atendimento presencial na capital.",
    resposta: "A Yide faz a gestão de Mercado Livre, Shopee e Amazon para empresas de Cuiabá. Cuidamos do cadastro, dos títulos e fotos, da reputação e dos anúncios pagos dentro do marketplace, com o time de e-commerce trabalhando na nossa sede no Jardim das Américas.",
    contexto: [
      "Para quem vende a partir de Cuiabá, o marketplace é o jeito mais rápido de chegar ao Brasil inteiro sem montar estrutura de venda em outro estado. O cuidado está na logística: prazo de envio, uso do Full quando faz sentido e preço que considere o frete a partir de Mato Grosso.",
      "Não apostamos tudo em um canal só. Marketplace traz volume, mas a margem e o cliente ficam com a plataforma; por isso combinamos com loja própria e WhatsApp quando o negócio pede. Já acompanhamos de perto operações de fábrica e de varejo que vendem em marketplace a partir de MT.",
    ],
    focos: [
      "Abertura e organização de contas no Mercado Livre, Shopee e Amazon",
      "Títulos, fichas técnicas e fotos para aparecer na busca",
      "Mercado Ads e anúncios patrocinados com controle de margem",
      "Reputação, perguntas e prazos de envio a partir de Cuiabá",
    ],
    faq: [
      { pergunta: "Empresa de Cuiabá consegue vender bem no Mercado Livre?", resposta: "Sim. O que define o resultado é preço, reputação e prazo de envio. Ajustamos esses pontos considerando o frete a partir de Mato Grosso." },
      { pergunta: "Vocês trabalham com Shopee e Amazon também?", resposta: "Sim. Organizamos os três canais com o mesmo catálogo e acompanhamos a margem de cada um." },
      { pergunta: "A reunião pode ser presencial?", resposta: "Sim. A sede da Yide fica no Jardim das Américas e também vamos até a sua empresa." },
    ],
  },
  {
    servico: "delivery-ifood",
    cidade: "cuiaba",
    titulo: "Gestão de iFood e delivery em Cuiabá",
    metaTitulo: "Gestão de iFood e Delivery em Cuiabá · Yide Digital",
    metaDescricao: "Gestão de iFood e delivery em Cuiabá: cardápio, fotos, ranking no app, anúncios na hora da fome e pedidos no WhatsApp. Cases Nazca Sushi e Kai Poke.",
    resposta: "A Yide faz a gestão de iFood e de delivery próprio para restaurantes de Cuiabá. Ajustamos cardápio, fotos e campanhas no app e montamos o pedido pelo WhatsApp com anúncio na hora da fome. Foi assim que a Nazca Sushi saiu de R$ 20 mil para mais de R$ 400 mil por mês.",
    contexto: [
      "Em Cuiabá o delivery tem picos bem marcados, no almoço e principalmente à noite e no fim de semana, e o calor faz muita gente preferir pedir a sair. Concentramos verba de anúncio nesses horários e nos bairros que mais pedem de cada restaurante, em vez de espalhar pelo dia inteiro.",
      "O iFood traz cliente novo, mas cobra taxa em cada pedido. Por isso trabalhamos os dois lados: posição e conversão dentro do app e um canal próprio pelo WhatsApp para a recompra, com resposta rápida e oferta no dia certo. A Kai Poke, que começou do zero no delivery, passou de R$ 50 mil por mês em um ano.",
    ],
    focos: [
      "Cardápio, combos e fotos para subir no ranking do iFood",
      "Anúncios no Instagram nos horários e bairros que mais pedem",
      "Pedido pelo WhatsApp com cardápio digital e resposta rápida",
      "Recompra: chamar de volta quem já pediu, sem taxa do app",
    ],
    faq: [
      { pergunta: "Quanto custa a gestão de delivery em Cuiabá?", resposta: "Os planos da Yide começam em R$ 1.000 por mês, e a verba de anúncios é à parte. Para delivery, é comum começar com R$ 20 a R$ 50 por dia nos horários de pico." },
      { pergunta: "Preciso sair do iFood?", resposta: "Não. O iFood continua trazendo cliente novo. O delivery próprio entra para a recompra, sem a taxa do aplicativo." },
      { pergunta: "Vocês fazem as fotos dos pratos em Cuiabá?", resposta: "Sim. Gravamos e fotografamos no seu restaurante ou no estúdio da Yide, no Jardim das Américas." },
    ],
  },
];

export function paginaLocal(servico: string, cidade: string): PaginaLocal | null {
  return PAGINAS_LOCAIS.find((p) => p.servico === servico && p.cidade === cidade) ?? null;
}

export function paginasLocaisDoServico(servico: string): PaginaLocal[] {
  return PAGINAS_LOCAIS.filter((p) => p.servico === servico);
}
