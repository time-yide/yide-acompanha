import { describe, expect, it } from "vitest";
import {
  avaliarSite, avaliarGoogle, avaliarGmn, avaliarRede, avaliarAnuncios, avaliarEcommerce, avaliarCrm,
} from "./regras";

const agora = new Date("2026-11-22T12:00:00Z");

describe("dados/regras", () => {
  const comSite = { semSite: false, siteUrl: "https://exemplo.com.br" };
  const semCadastro = { semSite: false, siteUrl: null };

  it("site", () => {
    expect(avaliarSite({ semSite: true, siteUrl: null })).toMatchObject({ status: "ausente", motivo: "Cliente não tem site" });
    expect(avaliarSite({ ...semCadastro, dados: null })).toMatchObject({ status: "sem_acesso", motivo: "Site não cadastrado" });
    expect(avaliarSite({ ...comSite, dados: null })).toMatchObject({ status: "sem_acesso", motivo: "Google Analytics não conectado" });
    expect(avaliarSite({ ...comSite, dados: { sessoes: 80, sessoesAnt: 70 } }).status).toBe("fraco");
    const queda = avaliarSite({ ...comSite, dados: { sessoes: 700, sessoesAnt: 1000 } });
    expect(queda.status).toBe("fraco");
    expect(queda.motivo).toBe("Site perdeu 30% das visitas");
    expect(avaliarSite({ ...comSite, dados: { sessoes: 1000, sessoesAnt: 1000 } }).status).toBe("ok");
    // Dados existem mesmo sem site cadastrado: avalia normal.
    expect(avaliarSite({ ...semCadastro, dados: { sessoes: 1000, sessoesAnt: 1000 } }).status).toBe("ok");
  });

  it("google busca", () => {
    expect(avaliarGoogle({ semSite: true, siteUrl: null }))
      .toMatchObject({ status: "ausente", motivo: "Sem site, não aparece na busca do Google" });
    expect(avaliarGoogle({ ...semCadastro, dados: null })).toMatchObject({ status: "sem_acesso", motivo: "Site não cadastrado" });
    expect(avaliarGoogle({ ...comSite, dados: null })).toMatchObject({ status: "sem_acesso", motivo: "Search Console não conectado" });
    expect(avaliarGoogle({ ...comSite, dados: { cliques: 100, cliquesAnt: 100, posicao: 25 } }).status).toBe("fraco");
    expect(avaliarGoogle({ ...comSite, dados: { cliques: 79, cliquesAnt: 100, posicao: 8 } }).motivo)
      .toBe("Cliques vindos do Google caíram 21%");
    expect(avaliarGoogle({ ...comSite, dados: { cliques: 100, cliquesAnt: 90, posicao: 8 } }).status).toBe("ok");
    expect(avaliarGoogle({ ...semCadastro, dados: { cliques: 100, cliquesAnt: 90, posicao: 8 } }).status).toBe("ok");
  });

  it("gmn", () => {
    expect(avaliarGmn({ temPerfil: false, nota: null, avaliacoes: null, avaliacoesAnt: null }).status).toBe("sem_acesso");
    expect(avaliarGmn({ temPerfil: true, nota: 4.1, avaliacoes: 50, avaliacoesAnt: 40 }).status).toBe("fraco");
    expect(avaliarGmn({ temPerfil: true, nota: 4.8, avaliacoes: 50, avaliacoesAnt: 50 }).motivo)
      .toBe("Nenhuma avaliação nova no Google");
    expect(avaliarGmn({ temPerfil: true, nota: 4.8, avaliacoes: 52, avaliacoesAnt: 50 }).status).toBe("ok");
  });

  it("instagram/facebook: mais de 3 dias sem post = fraco", () => {
    expect(avaliarRede("Instagram", { temPerfil: false }, agora).status).toBe("sem_acesso");
    expect(avaliarRede("Instagram", { temPerfil: true, dados: null }, agora).status).toBe("sem_acesso");
    const r = avaliarRede("Instagram", { temPerfil: true, dados: { ultimoPost: "2026-11-18T10:00:00Z", postsPeriodo: 9 } }, agora);
    expect(r.status).toBe("fraco");
    expect(r.motivo).toBe("Sem post no Instagram há 4 dias");
    expect(avaliarRede("Facebook", { temPerfil: true, dados: { ultimoPost: "2026-11-20T10:00:00Z", postsPeriodo: 9 } }, agora).status).toBe("ok");
    expect(avaliarRede("Facebook", { temPerfil: true, dados: { ultimoPost: null, postsPeriodo: 0 } }, agora).motivo)
      .toBe("Nenhum post no Facebook");
  });

  it("anúncios", () => {
    expect(avaliarAnuncios({ temConta: false }).status).toBe("sem_acesso");
    expect(avaliarAnuncios({ temConta: true, dados: { gasto: 0, gasto7d: 0, cliques: 0, impressoes: 0 } }).status).toBe("ausente");
    expect(avaliarAnuncios({ temConta: true, dados: { gasto: 500, gasto7d: 0, cliques: 10, impressoes: 900 } }).status).toBe("fraco");
    expect(avaliarAnuncios({ temConta: true, dados: { gasto: 500, gasto7d: 80, cliques: 10, impressoes: 900 } }).status).toBe("ok");
  });

  it("e-commerce", () => {
    expect(avaliarEcommerce({ aplica: false, dados: null }).status).toBe("nao_se_aplica");
    expect(avaliarEcommerce({ aplica: true, dados: null }).status).toBe("sem_acesso");
    expect(avaliarEcommerce({ aplica: true, dados: { anuncios: 0, anunciosAnt: 3 } }).status).toBe("fraco");
    expect(avaliarEcommerce({ aplica: true, dados: { anuncios: 7, anunciosAnt: 10 } }).status).toBe("fraco");
    expect(avaliarEcommerce({ aplica: true, dados: { anuncios: 9, anunciosAnt: 10 } }).status).toBe("ok");
  });

  it("crm", () => {
    expect(avaliarCrm({ crmTipo: null }).status).toBe("sem_acesso");
    expect(avaliarCrm({ crmTipo: "nenhum" })).toMatchObject({ status: "sem_acesso", motivo: "CRM não cadastrado" });
    expect(avaliarCrm({ crmTipo: "hubspot" }).status).toBe("sem_acesso");
    expect(avaliarCrm({ crmTipo: "yide", dados: null }).status).toBe("sem_acesso");
    const base = { leadsNovos: 20, vendas: 2, valorVendas: 1000, conversao: 0.1, semResposta24h: 0, origens: {} };
    expect(avaliarCrm({ crmTipo: "yide", dados: { atual: base, anterior: base } }).status).toBe("ok");
    expect(avaliarCrm({ crmTipo: "yide", dados: { atual: { ...base, semResposta24h: 6 }, anterior: base } }).motivo)
      .toBe("6 leads sem resposta há mais de 24h");
    expect(avaliarCrm({ crmTipo: "yide", dados: { atual: { ...base, vendas: 0 }, anterior: base } }).motivo)
      .toBe("Nenhuma venda registrada no período");
    expect(avaliarCrm({ crmTipo: "yide", dados: { atual: { ...base, leadsNovos: 10 }, anterior: base } }).motivo)
      .toBe("Leads novos caíram 50%");
  });
});
