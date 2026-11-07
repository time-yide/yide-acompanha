"use client";
import { useSyncExternalStore } from "react";
import { cidadeDaVisita } from "@/lib/site/cidade-visita";

const CHAVE = "yide_cidade_visita";
const nada = () => () => {};

function ler(): string | null {
  try {
    const daUrl = cidadeDaVisita(new URLSearchParams(window.location.search));
    if (daUrl) {
      sessionStorage.setItem(CHAVE, daUrl);
      return daUrl;
    }
    // Só reaproveita o que já passou pelo filtro de cidades conhecidas.
    const salva = sessionStorage.getItem(CHAVE);
    return salva ? cidadeDaVisita(new URLSearchParams({ cidade: salva })) : null;
  } catch {
    return null;
  }
}

/**
 * Texto com a cidade de quem veio pelo anúncio (?loc= do Google ou ?cidade=).
 * `comCidade` usa {cidade} no lugar do nome. Sem cidade conhecida, mostra `padrao`,
 * que também é o texto que o Google indexa.
 */
export function CidadeVisitante({ padrao, comCidade = "{cidade}" }: { padrao: string; comCidade?: string }) {
  const cidade = useSyncExternalStore(nada, ler, () => null);
  return <>{cidade ? comCidade.replace("{cidade}", cidade) : padrao}</>;
}
