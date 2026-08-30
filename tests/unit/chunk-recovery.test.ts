import { describe, it, expect, beforeEach } from "vitest";
import {
  isChunkLoadError,
  planRecovery,
  markRecovered,
  MAX_RELOADS,
  RELOAD_WINDOW_MS,
} from "@/lib/chunk-recovery";

// Store em memória que imita a API mínima de Storage usada por planRecovery.
function memStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

describe("isChunkLoadError", () => {
  it("reconhece erro com name ChunkLoadError", () => {
    expect(isChunkLoadError({ name: "ChunkLoadError", message: "x" })).toBe(true);
  });
  it("reconhece 'Loading chunk N failed' (webpack)", () => {
    expect(isChunkLoadError(new Error("Loading chunk 472 failed."))).toBe(true);
  });
  it("reconhece módulo dinâmico que falhou (Chrome)", () => {
    expect(
      isChunkLoadError(new Error("Failed to fetch dynamically imported module: https://x/_next/y.js")),
    ).toBe(true);
  });
  it("reconhece mensagem do Safari", () => {
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
  });
  it("ignora erro comum de aplicação", () => {
    expect(isChunkLoadError(new TypeError("foo is not a function"))).toBe(false);
  });
  it("ignora null/undefined", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("planRecovery — escalonamento e trava anti-loop", () => {
  let store: ReturnType<typeof memStore>;
  beforeEach(() => {
    store = memStore();
  });

  it("1ª tentativa: reload simples, sem hard clear", () => {
    const plan = planRecovery(1_000, store);
    expect(plan).toEqual({ attempt: 0, hardClear: false });
  });

  it("2ª tentativa (dentro da janela): escala pra hard clear", () => {
    planRecovery(1_000, store);
    const plan = planRecovery(2_000, store);
    expect(plan).toEqual({ attempt: 1, hardClear: true });
  });

  it("3ª tentativa dentro da janela: desiste (null) pra não entrar em loop", () => {
    planRecovery(1_000, store);
    planRecovery(2_000, store);
    const plan = planRecovery(3_000, store);
    expect(plan).toBeNull();
  });

  it("nunca passa de MAX_RELOADS tentativas na mesma janela", () => {
    let attempts = 0;
    let now = 0;
    while (planRecovery((now += 500), store) !== null) attempts++;
    expect(attempts).toBe(MAX_RELOADS);
  });

  it("depois da janela expirar, zera o contador e tenta de novo", () => {
    planRecovery(1_000, store);
    planRecovery(2_000, store);
    expect(planRecovery(3_000, store)).toBeNull();
    // passou a janela inteira → reset
    const plan = planRecovery(3_000 + RELOAD_WINDOW_MS + 1, store);
    expect(plan).toEqual({ attempt: 0, hardClear: false });
  });

  it("markRecovered zera o contador (carregou ok → próximo deploy ganha tentativas novas)", () => {
    planRecovery(1_000, store);
    planRecovery(2_000, store);
    markRecovered(store);
    const plan = planRecovery(2_500, store);
    expect(plan).toEqual({ attempt: 0, hardClear: false });
  });
});
