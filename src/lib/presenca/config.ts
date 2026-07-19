export type Canal = "gmn" | "linkedin";
export interface ItemChecklist { key: string; titulo: string; dica: string }

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

export function checklistDoCanal(canal: Canal): ItemChecklist[] {
  return canal === "gmn" ? CHECKLIST_GMN : CHECKLIST_LINKEDIN;
}
