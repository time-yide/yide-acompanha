export type CategoriaConquista = "tempo" | "produtividade" | "engajamento" | "area";

export type StatKey =
  | "mesesDeCasa" | "tarefasConcluidas" | "pesquisasRespondidas"
  | "entregasAudiovisual" | "ligacoesSaida" | "metaBatida"
  | "cardCompleto" | "discFeito";

export interface Conquista {
  key: string;
  categoria: CategoriaConquista;
  titulo: string;
  descricao: string;
  icone: string;          // nome do ícone lucide
  fonte: StatKey;
  alvo: number;           // fontes booleanas usam alvo=1 (stat 0/1)
  aplicavelRoles?: string[]; // se definido, só aparece pra esses cargos
}

export const CATEGORIA_LABEL: Record<CategoriaConquista, string> = {
  tempo: "Tempo de casa",
  produtividade: "Produtividade",
  engajamento: "Engajamento",
  area: "Metas & área",
};

const AUDIOVISUAL = ["videomaker", "editor", "fast_midia", "designer", "audiovisual_chefe"];
const COMERCIALISH = ["comercial", "assessor", "coordenador", "socio", "adm"];

export const CATALOGO: Conquista[] = [
  // Tempo de casa
  { key: "casa_novato", categoria: "tempo", titulo: "Novato", descricao: "Entrou pro time.", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 0 },
  { key: "casa_3m", categoria: "tempo", titulo: "3 meses de casa", descricao: "3 meses de jornada.", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 3 },
  { key: "casa_6m", categoria: "tempo", titulo: "6 meses de casa", descricao: "Meio ano de time.", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 6 },
  { key: "casa_1a", categoria: "tempo", titulo: "1 ano de casa", descricao: "Um ano junto!", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 12 },
  { key: "casa_2a", categoria: "tempo", titulo: "2 anos de casa", descricao: "Dois anos de estrada.", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 24 },
  { key: "casa_3a", categoria: "tempo", titulo: "3 anos de casa", descricao: "Veterano do time.", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 36 },
  // Produtividade
  { key: "tarefa_1", categoria: "produtividade", titulo: "Primeira entrega", descricao: "Concluiu a 1ª tarefa.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 1 },
  { key: "tarefa_10", categoria: "produtividade", titulo: "10 tarefas", descricao: "10 tarefas concluídas.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 10 },
  { key: "tarefa_50", categoria: "produtividade", titulo: "50 tarefas", descricao: "50 tarefas concluídas.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 50 },
  { key: "tarefa_100", categoria: "produtividade", titulo: "100 tarefas", descricao: "100 tarefas concluídas.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 100 },
  { key: "tarefa_250", categoria: "produtividade", titulo: "250 tarefas", descricao: "250 tarefas concluídas.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 250 },
  { key: "tarefa_500", categoria: "produtividade", titulo: "500 tarefas", descricao: "500 tarefas concluídas.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 500 },
  // Engajamento
  { key: "disc_feito", categoria: "engajamento", titulo: "Se conhece", descricao: "Respondeu o teste DISC.", icone: "Sparkles", fonte: "discFeito", alvo: 1 },
  { key: "pesquisa_3", categoria: "engajamento", titulo: "Participativo", descricao: "Respondeu 3 pesquisas.", icone: "Sparkles", fonte: "pesquisasRespondidas", alvo: 3 },
  { key: "pesquisa_10", categoria: "engajamento", titulo: "Voz ativa", descricao: "Respondeu 10 pesquisas.", icone: "Sparkles", fonte: "pesquisasRespondidas", alvo: 10 },
  { key: "card_completo", categoria: "engajamento", titulo: "Perfil completo", descricao: "Preencheu todo o card.", icone: "Sparkles", fonte: "cardCompleto", alvo: 1 },
  // Metas & área
  { key: "meta_mes", categoria: "area", titulo: "Meta do mês", descricao: "Bateu a meta do mês.", icone: "Target", fonte: "metaBatida", alvo: 1, aplicavelRoles: ["comercial"] },
  { key: "av_10", categoria: "area", titulo: "10 entregas", descricao: "10 entregas audiovisual.", icone: "Clapperboard", fonte: "entregasAudiovisual", alvo: 10, aplicavelRoles: AUDIOVISUAL },
  { key: "av_50", categoria: "area", titulo: "50 entregas", descricao: "50 entregas audiovisual.", icone: "Clapperboard", fonte: "entregasAudiovisual", alvo: 50, aplicavelRoles: AUDIOVISUAL },
  { key: "av_100", categoria: "area", titulo: "100 entregas", descricao: "100 entregas audiovisual.", icone: "Clapperboard", fonte: "entregasAudiovisual", alvo: 100, aplicavelRoles: AUDIOVISUAL },
  { key: "lig_50", categoria: "area", titulo: "50 ligações", descricao: "50 ligações feitas.", icone: "Phone", fonte: "ligacoesSaida", alvo: 50, aplicavelRoles: COMERCIALISH },
  { key: "lig_200", categoria: "area", titulo: "200 ligações", descricao: "200 ligações feitas.", icone: "Phone", fonte: "ligacoesSaida", alvo: 200, aplicavelRoles: COMERCIALISH },
  { key: "lig_500", categoria: "area", titulo: "500 ligações", descricao: "500 ligações feitas.", icone: "Phone", fonte: "ligacoesSaida", alvo: 500, aplicavelRoles: COMERCIALISH },
];
