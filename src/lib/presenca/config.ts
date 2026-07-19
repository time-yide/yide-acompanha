export type Canal =
  | "gmn"
  | "linkedin"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "threads"
  | "facebook"
  | "pinterest"
  | "medium";
export interface ItemChecklist { key: string; titulo: string; dica: string }

export const CANAIS: { value: Canal; label: string }[] = [
  { value: "gmn", label: "Google Meu Negócio" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "threads", label: "Threads" },
  { value: "facebook", label: "Facebook" },
  { value: "pinterest", label: "Pinterest" },
  { value: "medium", label: "Medium" },
];

export const CHECKLIST_GMN: ItemChecklist[] = [
  { key: "categoria", titulo: "Categoria principal correta", dica: "Ex.: Agência de marketing. É o que mais pesa pra aparecer nas buscas locais." },
  { key: "categorias_sec", titulo: "Categorias secundárias relevantes", dica: "Adicione todas que fizerem sentido (tráfego, criação de sites, etc.)." },
  { key: "descricao", titulo: "Descrição com palavras-chave locais", dica: "Cite serviços + cidades (Cuiabá, Várzea Grande, Salvador, Vila Velha)." },
  { key: "horario", titulo: "Horário de funcionamento completo", dica: "Preencha todos os dias, inclusive feriados especiais." },
  { key: "fotos", titulo: "Fotos atualizadas", dica: "Fachada, equipe, bastidores e trabalhos. Poste fotos com frequência." },
  { key: "servicos", titulo: "Produtos/serviços cadastrados", dica: "Liste cada serviço com descrição e valor (se aplicável)." },
  { key: "area", titulo: "Área de atendimento definida", dica: "Defina as praças que a Yide atende." },
  { key: "avaliacoes", titulo: "Responder todas as avaliações", dica: "Responda toda avaliação, positiva ou negativa. Peça avaliações aos clientes." },
  { key: "qa", titulo: "Perguntas e respostas (Q&A)", dica: "Crie perguntas frequentes e responda." },
  { key: "post_semanal", titulo: "Publicar post toda semana", dica: "Use o gerador de posts aqui do lado." },
  { key: "nap", titulo: "NAP consistente", dica: "Nome, telefone, endereço e site iguais em todos os lugares." },
  { key: "site", titulo: "Link do site oficial", dica: "Aponte pro yidedigital.com.br." },
];

export const CHECKLIST_LINKEDIN: ItemChecklist[] = [
  { key: "headline", titulo: "Headline com palavras-chave", dica: "Ex.: Agência de marketing e tecnologia em Cuiabá." },
  { key: "sobre", titulo: "Seção 'Sobre' otimizada", dica: "Descreva serviços e diferenciais com keywords locais." },
  { key: "logo", titulo: "Logo e capa atualizadas", dica: "Identidade visual da Yide na foto e na capa." },
  { key: "site", titulo: "Link do site no perfil", dica: "Adicione o yidedigital.com.br." },
  { key: "regular", titulo: "Publicar com regularidade", dica: "2 a 3 vezes por semana. Use o gerador ao lado." },
  { key: "funcionarios", titulo: "Funcionários vinculados", dica: "Peça ao time pra vincular a página nos perfis." },
  { key: "especialidades", titulo: "Especialidades preenchidas", dica: "Liste as áreas de atuação da Yide." },
  { key: "cta", titulo: "Botão de CTA configurado", dica: "Ex.: 'Visite o site' ou 'Fale conosco'." },
  { key: "local", titulo: "Localização e setor corretos", dica: "Cuiabá/MT e setor de marketing/publicidade." },
];

export const CHECKLIST_INSTAGRAM: ItemChecklist[] = [
  { key: "ig_bio", titulo: "Bio com serviço + cidade + link", dica: "Ex.: 'Marketing e tecnologia em Cuiabá'. Inclua o link do site." },
  { key: "ig_destaques", titulo: "Destaques organizados", dica: "Crie destaques de serviços, cases e depoimentos." },
  { key: "ig_feed", titulo: "Feed com identidade visual", dica: "Mantenha padrão de cores, fontes e logo da Yide." },
  { key: "ig_reels", titulo: "Reels toda semana", dica: "Reels dão mais alcance. Publique ao menos 1 por semana." },
  { key: "ig_contato", titulo: "Botões de contato ativos", dica: "Configure WhatsApp, e-mail e telefone no perfil profissional." },
  { key: "ig_local", titulo: "Marcar localização (Cuiabá)", dica: "Marque a cidade nos posts pra reforçar o SEO local." },
  { key: "ig_hashtags", titulo: "Hashtags locais + nicho", dica: "Misture hashtags da cidade com as do setor de marketing." },
];

export const CHECKLIST_TIKTOK: ItemChecklist[] = [
  { key: "tk_bio", titulo: "Bio clara + link", dica: "Diga o que a Yide faz e adicione o link do site." },
  { key: "tk_valor", titulo: "Conteúdo de valor", dica: "Dicas rápidas de marketing e negócios que geram salvamento." },
  { key: "tk_frequencia", titulo: "Postar 3x+ por semana", dica: "Constância é o que mais entrega alcance no TikTok." },
  { key: "tk_tendencias", titulo: "Usar áudios e tendências", dica: "Aproveite áudios em alta e formatos que estão bombando." },
  { key: "tk_legendas", titulo: "Legendas com palavras-chave", dica: "O TikTok também é busca. Use termos que as pessoas pesquisam." },
  { key: "tk_local", titulo: "Gancho local quando couber", dica: "Cite Cuiabá e a região pra atrair público próximo." },
];

export const CHECKLIST_YOUTUBE: ItemChecklist[] = [
  { key: "yt_canal", titulo: "Canal com descrição e keywords", dica: "Descreva a Yide e os temas do canal com palavras-chave." },
  { key: "yt_playlists", titulo: "Playlists por tema", dica: "Agrupe vídeos por assunto pra melhorar a navegação e o tempo de sessão." },
  { key: "yt_titulos", titulo: "Títulos e thumbnails otimizados", dica: "Use pergunta ou benefício claro no título e thumbnail chamativa." },
  { key: "yt_formatos", titulo: "Shorts + vídeos longos", dica: "Shorts pra alcance, vídeos longos pra autoridade." },
  { key: "yt_descricao", titulo: "Descrições com keywords e link", dica: "Escreva descrição rica e sempre inclua o link do site." },
  { key: "yt_cta", titulo: "CTA pro site / WhatsApp", dica: "Chame pra ação no vídeo e na descrição." },
  { key: "yt_frequencia", titulo: "Frequência regular", dica: "Mantenha um ritmo de publicação previsível." },
];

export const CHECKLIST_THREADS: ItemChecklist[] = [
  { key: "th_perfil", titulo: "Perfil completo + link", dica: "Bio clara e link do site no perfil." },
  { key: "th_regular", titulo: "Postar com regularidade", dica: "Reaproveite conteúdo do Instagram e poste com constância." },
  { key: "th_conversas", titulo: "Participar de conversas do nicho", dica: "Comente e responda perfis do setor pra ganhar alcance." },
  { key: "th_valor", titulo: "Threads de valor", dica: "Dicas, opiniões e bastidores que gerem engajamento." },
];

export const CHECKLIST_FACEBOOK: ItemChecklist[] = [
  { key: "fb_pagina", titulo: "Página completa", dica: "Preencha sobre, contato, endereço e horário." },
  { key: "fb_integrada", titulo: "Integrada ao Instagram / GMN", dica: "Conecte a página ao Instagram e ao Google Meu Negócio." },
  { key: "fb_regular", titulo: "Publicar com regularidade", dica: "Mantenha a página ativa com posts frequentes." },
  { key: "fb_avaliacoes", titulo: "Coletar e responder avaliações", dica: "Peça avaliações e responda todas com atenção." },
  { key: "fb_grupos", titulo: "Participar de grupos locais", dica: "Entre em grupos de Cuiabá e região pra gerar autoridade." },
];

export const CHECKLIST_PINTEREST: ItemChecklist[] = [
  { key: "pin_perfil", titulo: "Perfil de negócios + site verificado", dica: "Use conta business e verifique o domínio da Yide." },
  { key: "pin_pastas", titulo: "Pastas por tema", dica: "Organize pins por assunto (marketing, sites, dicas)." },
  { key: "pin_keywords", titulo: "Pins com títulos e descrições", dica: "Use palavras-chave nos títulos e descrições dos pins." },
  { key: "pin_link", titulo: "Pins que linkam pro blog/site", dica: "Cada pin deve levar pro blog ou pro site da Yide." },
  { key: "pin_regular", titulo: "Fixar com regularidade", dica: "Pinte com constância pra ganhar tração no algoritmo." },
];

export const CHECKLIST_MEDIUM: ItemChecklist[] = [
  { key: "md_perfil", titulo: "Perfil com bio + link", dica: "Bio profissional e link do site da Yide." },
  { key: "md_republicar", titulo: "Republicar artigos do blog", dica: "Use canonical apontando pro site pra não competir com o original." },
  { key: "md_tags", titulo: "Tags relevantes", dica: "Adicione tags do nicho pra ser encontrada." },
  { key: "md_publicacoes", titulo: "Enviar pra publicações do nicho", dica: "Submeta artigos a publicações de marketing e negócios." },
  { key: "md_cta", titulo: "CTA pro site no fim", dica: "Feche cada artigo com um convite pro site da Yide." },
];

export function checklistDoCanal(canal: Canal): ItemChecklist[] {
  switch (canal) {
    case "gmn": return CHECKLIST_GMN;
    case "linkedin": return CHECKLIST_LINKEDIN;
    case "instagram": return CHECKLIST_INSTAGRAM;
    case "tiktok": return CHECKLIST_TIKTOK;
    case "youtube": return CHECKLIST_YOUTUBE;
    case "threads": return CHECKLIST_THREADS;
    case "facebook": return CHECKLIST_FACEBOOK;
    case "pinterest": return CHECKLIST_PINTEREST;
    case "medium": return CHECKLIST_MEDIUM;
  }
}
