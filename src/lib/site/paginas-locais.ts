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
      { pergunta: "Quanto custa tráfego pago em Cuiabá?", resposta: "Há duas partes: a gestão da Yide e a verba paga ao Google e à Meta. Para negócios locais da capital, é comum começar com R$ 20 a R$ 50 por dia de verba. No diagnóstico gratuito indicamos o valor para o seu caso." },
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
];

export function paginaLocal(servico: string, cidade: string): PaginaLocal | null {
  return PAGINAS_LOCAIS.find((p) => p.servico === servico && p.cidade === cidade) ?? null;
}

export function paginasLocaisDoServico(servico: string): PaginaLocal[] {
  return PAGINAS_LOCAIS.filter((p) => p.servico === servico);
}
