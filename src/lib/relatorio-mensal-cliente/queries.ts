import "server-only";

export interface ClientMonthlyMetrics {
  clientId: string;
  clienteNome: string;
  telefone: string;
  postsPublicados: number;
  postsPorFormato: { feed: number; story: number; reel: number; outro: number };
  metricas: {
    alcance: number;
    curtidas: number;
    comentarios: number;
    salvamentos: number;
    compartilhamentos: number;
    engajamento: number;
  };
  metricasMesAnterior: {
    alcance: number;
    curtidas: number;
    comentarios: number;
    salvamentos: number;
    compartilhamentos: number;
    engajamento: number;
  };
}

/**
 * Monthly client reports — social media metrics were removed.
 * Returns an empty array so callers don't break.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getClientMonthlyReports(
  _orgId: string, _mesInicio: string, _mesFim: string,
  _mesAnteriorInicio: string, _mesAnteriorFim: string,
): Promise<ClientMonthlyMetrics[]> {
  return [];
}
