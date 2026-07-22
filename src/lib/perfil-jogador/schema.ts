export type Classe = "Colérico" | "Sanguíneo" | "Melancólico" | "Fleumático";

export interface PerfilJogador {
  user_id: string;
  username: string | null;
  capa_url: string | null;
  bio: string | null;
  como_trabalho: string | null;
  hobbies: string[];
  frase: string | null;
}

export interface SinergiaItem {
  userId: string;
  nome: string;
  avatarUrl: string | null;
  motivo: string; // ex.: "combina no trabalho" ou "curte: jogos, música"
}

export interface CardData {
  userId: string;
  nome: string;
  roleDoUsuario: string;
  cargoLabel: string;
  avatarUrl: string | null;
  tempoDeCasa: string | null; // ex.: "8 meses de casa"
  perfil: PerfilJogador | null;
  classe: Classe | null;
  classeDescricao: string | null;
  sinergiaTrabalho: SinergiaItem[];
  sinergiaHobbies: SinergiaItem[];
  pesquisasRespondidas: { id: string; titulo: string }[];
}
