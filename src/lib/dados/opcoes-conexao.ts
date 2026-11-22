// SERVER ONLY
import "server-only";
import { unstable_cache } from "next/cache";
import { listarPropriedadesGa4, listarSitesGsc } from "./coletores/google";
import { listarEmpresasLyide } from "./coletores/lyide";

/** Falha vira exceção: unstable_cache não guarda erro, então uma falha momentânea não fica 15 min em cache como lista vazia. */
function ouFalha<T>(fn: () => Promise<T | null>, nome: string) {
  return async (): Promise<T> => {
    const r = await fn();
    if (r == null) throw new Error(`[dados/opcoes] ${nome} indisponível`);
    return r;
  };
}

// Só credenciais de serviço (sem cookies): pode ficar em unstable_cache.
// Quem chama deve tratar a exceção (.catch(() => [])).
export const ga4Cache = unstable_cache(ouFalha(listarPropriedadesGa4, "ga4"), ["dados-opcoes-ga4"], { revalidate: 900 });
export const gscCache = unstable_cache(ouFalha(listarSitesGsc, "gsc"), ["dados-opcoes-gsc"], { revalidate: 900 });
export const lyideCache = unstable_cache(ouFalha(listarEmpresasLyide, "lyide"), ["dados-opcoes-lyide"], { revalidate: 900 });
