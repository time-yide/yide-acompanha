// Módulo puro (sem server-only): tipos compartilhados entre servidor e o botão "Conectar automaticamente".

export const CAMPOS_CONEXAO = [
  "instagram_business_id",
  "facebook_page_id",
  "meta_ad_account_id",
  "ga4_property_id",
  "gsc_site_url",
  "crm_identifier",
] as const;
export type CampoConexao = (typeof CAMPOS_CONEXAO)[number];

export type Confianca = "alta" | "media";

export interface Sugestao {
  campo: CampoConexao;
  valor: string;
  rotulo: string;
  confianca: Confianca;
  motivo: string;
}

export interface SugestoesCliente {
  clientId: string;
  clienteNome: string;
  itens: Sugestao[];
}

export interface FontesStatus {
  meta: boolean;
  anuncios: boolean;
  ga4: boolean;
  gsc: boolean;
  lyide: boolean;
}

export interface ResultadoSugestoes {
  sugestoes: SugestoesCliente[];
  fontes: FontesStatus;
}
