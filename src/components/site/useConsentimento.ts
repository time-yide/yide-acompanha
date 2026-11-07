"use client";
import { useSyncExternalStore } from "react";
import { CHAVE_CONSENTIMENTO, EVENTO_CONSENTIMENTO, lerConsentimento, type Consentimento } from "@/lib/site/consentimento";

function assinar(aoMudar: () => void) {
  window.addEventListener(EVENTO_CONSENTIMENTO, aoMudar);
  window.addEventListener("storage", aoMudar);
  return () => {
    window.removeEventListener(EVENTO_CONSENTIMENTO, aoMudar);
    window.removeEventListener("storage", aoMudar);
  };
}

function ler(): Consentimento | "sem-resposta" {
  try {
    return lerConsentimento(localStorage.getItem(CHAVE_CONSENTIMENTO)) ?? "sem-resposta";
  } catch {
    return "sem-resposta";
  }
}

/** Escolha de cookies do visitante. No servidor (e antes de hidratar) é "carregando". */
export function useConsentimento(): Consentimento | "sem-resposta" | "carregando" {
  return useSyncExternalStore(assinar, ler, () => "carregando");
}
