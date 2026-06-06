// tests/unit/design-studio-comandos.test.ts
import { describe, it, expect } from "vitest";
import { parseRespostaIA, ACOES_VALIDAS } from "@/lib/design/studio-comandos";

describe("parseRespostaIA", () => {
  it("separa mensagem e comandos pelo marcador ---JSON---", () => {
    const raw = `Vou criar um post simples.\n---JSON---\n{"commands":[{"action":"setBg","color":"#000000"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.mensagem).toBe("Vou criar um post simples.");
    expect(out.comandos).toEqual([{ action: "setBg", color: "#000000" }]);
  });

  it("tolera fences de markdown no JSON", () => {
    const raw = "ok\n---JSON---\n```json\n{\"commands\":[{\"action\":\"clearAll\"}]}\n```";
    const out = parseRespostaIA(raw);
    expect(out.comandos).toEqual([{ action: "clearAll" }]);
  });

  it("descarta comando com action desconhecida", () => {
    const raw = `x\n---JSON---\n{"commands":[{"action":"hackTheGibson"},{"action":"clearAll"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos).toEqual([{ action: "clearAll" }]);
  });

  it("descarta addTexto sem campo text", () => {
    const raw = `x\n---JSON---\n{"commands":[{"action":"addTexto","x":10,"y":10}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos).toEqual([]);
  });

  it("mantém addTexto válido com defaults preenchidos", () => {
    const raw = `x\n---JSON---\n{"commands":[{"action":"addTexto","text":"OI"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos).toHaveLength(1);
    const cmd = out.comandos[0] as Record<string, unknown>;
    expect(cmd.action).toBe("addTexto");
    expect(cmd.text).toBe("OI");
    expect(typeof cmd.x).toBe("number");
    expect(typeof cmd.color).toBe("string");
  });

  it("sem marcador, mensagem é o texto todo e comandos vazios", () => {
    const out = parseRespostaIA("Só uma resposta de texto.");
    expect(out.mensagem).toBe("Só uma resposta de texto.");
    expect(out.comandos).toEqual([]);
  });

  it("JSON inválido não quebra — retorna comandos vazios", () => {
    const raw = `x\n---JSON---\n{isso não é json}`;
    const out = parseRespostaIA(raw);
    expect(out.mensagem).toBe("x");
    expect(out.comandos).toEqual([]);
  });

  it("setFormato com formato conhecido é mantido", () => {
    const raw = `x\n---JSON---\n{"commands":[{"action":"setFormato","formato":"story"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos).toEqual([{ action: "setFormato", formato: "story" }]);
  });

  it("setFormato com formato desconhecido é descartado", () => {
    const raw = `x\n---JSON---\n{"commands":[{"action":"setFormato","formato":"tiktok"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos).toEqual([]);
  });

  it("ACOES_VALIDAS cobre o contrato da Fase 1", () => {
    expect(ACOES_VALIDAS).toEqual(
      expect.arrayContaining([
        "setBg", "setFormato", "toggleStripes", "addTexto",
        "addShape", "addLogo", "updateLayer", "removeLayer", "clearAll",
      ]),
    );
  });
});
