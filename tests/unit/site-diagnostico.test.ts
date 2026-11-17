import { describe, it, expect } from "vitest";
import { montarMensagemDiagnostico } from "@/lib/site/diagnostico";

describe("montarMensagemDiagnostico", () => {
  it("monta a mensagem com as respostas", () => {
    const r = montarMensagemDiagnostico({ nome: " Ana ", empresa: "Pizzaria do Bairro", cidade: "Várzea Grande", objetivo: "Mais clientes no WhatsApp" });
    expect(r).toEqual({ ok: true, texto: "Olá! Quero um diagnóstico gratuito da Yide.\nNome: Ana\nEmpresa: Pizzaria do Bairro\nCidade: Várzea Grande\nObjetivo: Mais clientes no WhatsApp" });
  });
  it("pede nome e empresa", () => {
    expect(montarMensagemDiagnostico({ nome: "", empresa: "X", cidade: "", objetivo: "" })).toEqual({ ok: false, erro: "Preencha seu nome e a empresa." });
    expect(montarMensagemDiagnostico({ nome: "Ana", empresa: " ", cidade: "", objetivo: "" }).ok).toBe(false);
  });
  it("omite cidade e objetivo vazios", () => {
    const r = montarMensagemDiagnostico({ nome: "Ana", empresa: "Loja", cidade: "", objetivo: "" });
    expect(r.ok && r.texto).toBe("Olá! Quero um diagnóstico gratuito da Yide.\nNome: Ana\nEmpresa: Loja");
  });
});
