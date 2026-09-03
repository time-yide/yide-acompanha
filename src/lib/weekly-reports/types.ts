export interface MetricaComparacao {
  valor: number;
  anterior: number;
  variacao_pct: number;
}

export interface WeeklyReportData {
  posts_publicados: number;
  posts_detalhes: {
    titulo: string;
    rede: string;
    formato: string;
    publicado_em: string;
  }[];
  metricas: {
    alcance: MetricaComparacao;
    curtidas: MetricaComparacao;
    comentarios: MetricaComparacao;
    salvamentos: MetricaComparacao;
    compartilhamentos: MetricaComparacao;
    engajamento_total: MetricaComparacao;
  };
}

export interface WeeklyReportRow {
  id: string;
  organization_id: string;
  client_id: string;
  semana_inicio: string;
  semana_fim: string;
  dados: WeeklyReportData;
  whatsapp_enviado: boolean;
  whatsapp_enviado_em: string | null;
  created_at: string;
}
