import { describe, it, expect } from "vitest";
import {
  roleParaSetor,
  isRoleAudiovisual,
  pctNoPrazo,
  resolveMetricaPessoa,
  type MetricaCrua,
} from "./setor-metricas";

describe("roleParaSetor", () => {
  it("mapeia cada cargo pro setor certo", () => {
    expect(roleParaSetor("comercial")).toBe("comercial");
    expect(roleParaSetor("assessor_ecommerce")).toBe("ecommerce");
    expect(roleParaSetor("assistente_ecommerce")).toBe("ecommerce");
    expect(roleParaSetor("assessor", "ecommerce")).toBe("ecommerce");
    expect(roleParaSetor("assessor", null)).toBe("assessoria");
    expect(roleParaSetor("assessor")).toBe("assessoria");
    expect(roleParaSetor("designer")).toBe("design");
    expect(roleParaSetor("videomaker")).toBe("audiovisual");
    expect(roleParaSetor("adm")).toBeNull();
    expect(roleParaSetor("socio")).toBeNull();
    expect(roleParaSetor("programacao")).toBeNull();
  });
});

describe("isRoleAudiovisual", () => {
  it("cobre a equipe de produção audiovisual", () => {
    expect(isRoleAudiovisual("videomaker")).toBe(true);
    expect(isRoleAudiovisual("editor")).toBe(true);
    expect(isRoleAudiovisual("fast_midia")).toBe(true);
    expect(isRoleAudiovisual("assessor")).toBe(false);
  });
});

describe("pctNoPrazo", () => {
  it("razão em % (0-100), null quando sem tarefas com prazo", () => {
    expect(pctNoPrazo(9, 10)).toBe(90);
    expect(pctNoPrazo(0, 4)).toBe(0);
    expect(pctNoPrazo(0, 0)).toBeNull();
  });
});

describe("resolveMetricaPessoa", () => {
  const crua = (over: Partial<MetricaCrua>): MetricaCrua => ({
    ligacoes_feitas: 0, ligacoes_atendidas: 0, anuncios: 0,
    tarefas_entregues: 0, tarefas_no_prazo: 0, tarefas_com_prazo: 0,
    tarefas_atrasadas: 0, postagens: 0, artes: 0, ...over,
  });

  it("comercial → ligações", () => {
    const m = resolveMetricaPessoa("comercial", null, crua({ ligacoes_feitas: 45 }));
    expect(m).toEqual({ setor: "comercial", valor: 45, unidade: "contagem", rotulo: "45 ligações" });
  });
  it("ecommerce → anúncios", () => {
    const m = resolveMetricaPessoa("assistente_ecommerce", null, crua({ anuncios: 320 }));
    expect(m.rotulo).toBe("320 anúncios");
    expect(m.valor).toBe(320);
  });
  it("assessoria → % no prazo", () => {
    const m = resolveMetricaPessoa("assessor", null, crua({ tarefas_no_prazo: 11, tarefas_com_prazo: 12 }));
    expect(m.unidade).toBe("percentual");
    expect(m.valor).toBeCloseTo(91.666, 1);
    expect(m.rotulo).toBe("92% no prazo");
  });
  it("assessoria sem tarefas com prazo → —", () => {
    const m = resolveMetricaPessoa("assessor", null, crua({}));
    expect(m.valor).toBeNull();
    expect(m.rotulo).toBe("—");
  });
  it("design → artes", () => {
    const m = resolveMetricaPessoa("designer", null, crua({ artes: 25 }));
    expect(m.rotulo).toBe("25 artes");
  });
  it("gestão (adm) → sem setor, —", () => {
    const m = resolveMetricaPessoa("adm", null, crua({}));
    expect(m.setor).toBeNull();
    expect(m.rotulo).toBe("—");
  });
  it("singular: 1 ligação / 1 arte / 1 anúncio", () => {
    expect(resolveMetricaPessoa("comercial", null, crua({ ligacoes_feitas: 1 })).rotulo).toBe("1 ligação");
    expect(resolveMetricaPessoa("designer", null, crua({ artes: 1 })).rotulo).toBe("1 arte");
    expect(resolveMetricaPessoa("assessor_ecommerce", null, crua({ anuncios: 1 })).rotulo).toBe("1 anúncio");
  });
});
