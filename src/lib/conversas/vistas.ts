"use client";

import { useSyncExternalStore } from "react";

/**
 * Marca de "conversa vista" guardada no navegador.
 *
 * O Lyide não expõe "não lidas" — a bolinha verde significa "a última
 * mensagem é do cliente". Pra ela sumir quando a pessoa abre a conversa,
 * guardamos o horário da última mensagem que ela viu. Se chegar mensagem
 * nova (ultima_msg_em muda), a bolinha volta sozinha.
 */
const KEY = "conversas:vistas:v1";
const EVENTO = "conversas-vistas";

type Vistas = Record<string, string>;

let cacheRaw: string | null = null;
let cache: Vistas = {};

function ler(): Vistas {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== cacheRaw) {
      cacheRaw = raw;
      cache = raw ? (JSON.parse(raw) as Vistas) : {};
    }
  } catch {
    // storage bloqueado: segue com o que tem em memória
  }
  return cache;
}

export function marcarConversaVista(id: string, ultimaMsgEm: string | null) {
  if (!ultimaMsgEm) return;
  const atual = ler();
  if (atual[id] === ultimaMsgEm) return;
  const novo = { ...atual, [id]: ultimaMsgEm };
  cache = novo;
  try {
    cacheRaw = JSON.stringify(novo);
    window.localStorage.setItem(KEY, cacheRaw);
  } catch {
    // ignora: fica só em memória nesta aba
  }
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

const VAZIO: Vistas = {};

/** true se a pessoa já abriu essa conversa depois da última mensagem. */
export function useConversaVista(id: string, ultimaMsgEm: string | null): boolean {
  const vistas = useSyncExternalStore(assinar, ler, () => VAZIO);
  return !!ultimaMsgEm && vistas[id] === ultimaMsgEm;
}
