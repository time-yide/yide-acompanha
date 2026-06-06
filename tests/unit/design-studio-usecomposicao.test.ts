// tests/unit/design-studio-usecomposicao.test.ts
import { describe, it, expect } from "vitest";
import { composicaoReducer, aplicarComandos } from "@/components/design/studio/useComposicao";
import { COMPOSICAO_VAZIA } from "@/lib/design/studio-tipos";

describe("composicaoReducer", () => {
  it("addTexto adiciona uma camada de texto", () => {
    const st = composicaoReducer(COMPOSICAO_VAZIA, {
      type: "addCamada",
      camada: { tipo: "texto", text: "OI", x: 0, y: 0, w: 100, fontSize: 20, fontWeight: 700, color: "#fff", align: "center", font: "Inter", spacing: 0, opacity: 1 },
    });
    expect(st.camadas).toHaveLength(1);
    expect(st.camadas[0].tipo).toBe("texto");
    expect(st.camadas[0].id).toBeTruthy();
  });

  it("removeCamada remove pelo id", () => {
    const add = composicaoReducer(COMPOSICAO_VAZIA, {
      type: "addCamada",
      camada: { tipo: "shape", subtype: "rect", x: 0, y: 0, w: 10, h: 10, bg: "#000", borderColor: "transparent", borderW: 0, radius: 0, opacity: 1 },
    });
    const id = add.camadas[0].id;
    const rem = composicaoReducer(add, { type: "removeCamada", id });
    expect(rem.camadas).toHaveLength(0);
  });

  it("setBg muda a cor de fundo", () => {
    const st = composicaoReducer(COMPOSICAO_VAZIA, { type: "setBg", cor: "#123456" });
    expect(st.fundo.cor).toBe("#123456");
  });
});

describe("aplicarComandos", () => {
  it("executa setBg + addTexto vindos da IA", () => {
    const st = aplicarComandos(COMPOSICAO_VAZIA, [
      { action: "setBg", color: "#000000" },
      { action: "addTexto", text: "BRASIL", x: 10, y: 10, w: 100, fontSize: 40, fontWeight: 900, color: "#ffdf00", align: "center", font: "Inter", spacing: 0 },
    ], "logo.png");
    expect(st.fundo.cor).toBe("#000000");
    expect(st.camadas).toHaveLength(1);
    expect((st.camadas[0] as { text: string }).text).toBe("BRASIL");
  });

  it("clearAll esvazia as camadas", () => {
    const com = aplicarComandos(COMPOSICAO_VAZIA, [
      { action: "addTexto", text: "X", x: 0, y: 0, w: 1, fontSize: 1, fontWeight: 1, color: "#000", align: "left", font: "Inter", spacing: 0 },
    ], null);
    const limpo = aplicarComandos(com, [{ action: "clearAll" }], null);
    expect(limpo.camadas).toHaveLength(0);
  });

  it("addLogo usa a logoUrl do cliente", () => {
    const st = aplicarComandos(COMPOSICAO_VAZIA, [{ action: "addLogo", x: 1, y: 2, w: 3, h: 4 }], "logo.png");
    expect(st.camadas).toHaveLength(1);
    expect(st.camadas[0].tipo).toBe("logo");
    expect((st.camadas[0] as { src: string }).src).toBe("logo.png");
  });

  it("addLogo é ignorado se não há logo do cliente", () => {
    const st = aplicarComandos(COMPOSICAO_VAZIA, [{ action: "addLogo", x: 1, y: 2, w: 3, h: 4 }], null);
    expect(st.camadas).toHaveLength(0);
  });
});
