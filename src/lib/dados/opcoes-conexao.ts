// SERVER ONLY
import "server-only";
import { unstable_cache } from "next/cache";
import { listarPropriedadesGa4, listarSitesGsc } from "./coletores/google";
import { listarEmpresasLyide } from "./coletores/lyide";

// Só credenciais de serviço (sem cookies): pode ficar em unstable_cache.
export const ga4Cache = unstable_cache(() => listarPropriedadesGa4(), ["dados-opcoes-ga4"], { revalidate: 900 });
export const gscCache = unstable_cache(() => listarSitesGsc(), ["dados-opcoes-gsc"], { revalidate: 900 });
export const lyideCache = unstable_cache(() => listarEmpresasLyide(), ["dados-opcoes-lyide"], { revalidate: 900 });
