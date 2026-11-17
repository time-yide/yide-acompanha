import { describe, it, expect } from "vitest";
import { precisaTrocarCapa, escolherFotoNaoUsada, consultasDeFoto } from "@/lib/blog/capas";

const CAPA_IA = "https://abc.supabase.co/storage/v1/object/public/blog/capas/uuid.png";

describe("precisaTrocarCapa", () => {
  it("troca capa gerada por IA e post sem capa", () => {
    expect(precisaTrocarCapa(CAPA_IA)).toBe(true);
    expect(precisaTrocarCapa(null)).toBe(true);
    expect(precisaTrocarCapa("")).toBe(true);
  });
  it("mantém foto do Pexels e capa colocada à mão", () => {
    expect(precisaTrocarCapa("https://images.pexels.com/photos/1/pexels-photo-1.jpeg")).toBe(false);
    expect(precisaTrocarCapa("https://yide.com.br/foto-do-cliente.jpg")).toBe(false);
  });
});

describe("escolherFotoNaoUsada", () => {
  it("pula foto que já está em outro post", () => {
    expect(escolherFotoNaoUsada(["a", "b", "c"], new Set(["a", "b"]))).toBe("c");
  });
  it("devolve null quando todas já foram usadas", () => {
    expect(escolherFotoNaoUsada(["a"], new Set(["a"]))).toBeNull();
    expect(escolherFotoNaoUsada([], new Set())).toBeNull();
  });
});

describe("consultasDeFoto", () => {
  it("vai das keywords pro título, sem repetir", () => {
    expect(consultasDeFoto(["seo", "google", "site", "extra"], "Título")).toEqual(["seo google site", "seo", "Título"]);
    expect(consultasDeFoto(["seo"], "Título")).toEqual(["seo", "Título"]);
  });
  it("post sem keywords busca pelo título", () => {
    expect(consultasDeFoto([], "Título")).toEqual(["Título"]);
  });
});
