import { describe, expect, it } from "vitest";
import {
  gerarCodigoEquipamento,
  normalizarCodigo,
  podeGerenciarVistoria,
  progressoVistoria,
  resumoEstoque,
} from "./core";

describe("gerarCodigoEquipamento", () => {
  it("gera YD- + 6 caracteres do alfabeto sem ambíguos", () => {
    const codigo = gerarCodigoEquipamento(() => 0.999);
    expect(codigo).toMatch(/^YD-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("é determinístico com o rand injetado", () => {
    expect(gerarCodigoEquipamento(() => 0)).toBe("YD-AAAAAA");
  });
});

describe("normalizarCodigo", () => {
  it("põe em maiúsculas e tira espaços", () => {
    expect(normalizarCodigo("  yd-7k3qp2 ")).toBe("YD-7K3QP2");
  });

  it("extrai o código de uma URL", () => {
    expect(normalizarCodigo("https://app.exemplo.com/vistoria/yd-7k3qp2")).toBe("YD-7K3QP2");
  });
});

describe("podeGerenciarVistoria", () => {
  it("libera adm, sócio e assistente", () => {
    expect(podeGerenciarVistoria("adm")).toBe(true);
    expect(podeGerenciarVistoria("socio")).toBe(true);
    expect(podeGerenciarVistoria("audiovisual_chefe")).toBe(true);
  });

  it("nega videomaker e assessor", () => {
    expect(podeGerenciarVistoria("videomaker")).toBe(false);
    expect(podeGerenciarVistoria("assessor")).toBe(false);
  });
});

describe("resumoEstoque", () => {
  it("separa estoque, com responsável, manutenção e baixados", () => {
    const r = resumoEstoque([
      { categoria: "camera", status: "ativo", responsavel_id: null },
      { categoria: "camera", status: "ativo", responsavel_id: "a" },
      { categoria: "computador", status: "manutencao", responsavel_id: "a" },
      { categoria: "lente", status: "baixado", responsavel_id: null },
      { categoria: "lente", status: "ativo", responsavel_id: null },
    ]);
    expect(r.total).toBe(5);
    expect(r.noEstoque).toBe(2);
    expect(r.comResponsavel).toBe(1);
    expect(r.emManutencao).toBe(1);
    expect(r.baixados).toBe(1);
    expect(r.porCategoria).toEqual({ camera: 2, computador: 1, lente: 2 });
  });

  it("lista vazia zera tudo", () => {
    const r = resumoEstoque([]);
    expect(r).toEqual({ total: 0, noEstoque: 0, comResponsavel: 0, emManutencao: 0, baixados: 0, porCategoria: {} });
  });
});

describe("progressoVistoria", () => {
  it("calcula faltando e completa", () => {
    expect(progressoVistoria(4, 1)).toEqual({ total: 4, conferidos: 1, faltando: 3, completa: false });
    expect(progressoVistoria(4, 4)).toEqual({ total: 4, conferidos: 4, faltando: 0, completa: true });
  });

  it("sem equipamento não é completa", () => {
    expect(progressoVistoria(0, 0).completa).toBe(false);
  });

  it("limita conferidos ao total", () => {
    expect(progressoVistoria(2, 5).conferidos).toBe(2);
  });
});

describe("caminhos de foto", () => {
  const uid = "11111111-2222-3333-4444-555555555555";
  const foto = "66666666-7777-8888-9999-aaaaaaaaaaaa";

  it("aceita só o caminho de equipamento gerado pelo servidor", async () => {
    const { caminhoFotoEquipamentoValido } = await import("./core");
    expect(caminhoFotoEquipamentoValido(`equipamento/${foto}.jpg`)).toBe(true);
    expect(caminhoFotoEquipamentoValido(`conferencia/${uid}/${foto}.jpg`)).toBe(false);
    expect(caminhoFotoEquipamentoValido("https://evil.example/x.jpg")).toBe(false);
    expect(caminhoFotoEquipamentoValido(`equipamento/${foto}.jpg/../../x`)).toBe(false);
  });

  it("conferência só aceita a própria pasta", async () => {
    const { caminhoFotoConferenciaValido } = await import("./core");
    expect(caminhoFotoConferenciaValido(`conferencia/${uid}/${foto}.png`, uid)).toBe(true);
    expect(caminhoFotoConferenciaValido(`conferencia/${uid}/${foto}.png`, "outra")).toBe(false);
    expect(caminhoFotoConferenciaValido(`equipamento/${foto}.png`, uid)).toBe(false);
  });
});
