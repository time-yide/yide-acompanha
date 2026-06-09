// tests/unit/batidas.test.ts
import { describe, it, expect } from "vitest";
import { montarProspectosCadencia } from "@/lib/batidas/aggregate";
import {
  BATIDAS_META,
  leadGeradoEmSucesso,
  leadGeradoDescartado,
  leadOnboardingEmSucesso,
  leadOnboardingDescartado,
  roleVeTudo,
} from "@/lib/batidas/config";

describe("config batidas", () => {
  it("meta é 14", () => {
    expect(BATIDAS_META).toBe(14);
  });

  it("leads_gerados em sucesso", () => {
    expect(leadGeradoEmSucesso("reuniao_marcada")).toBe(true);
    expect(leadGeradoEmSucesso("proposta_enviada")).toBe(true);
    expect(leadGeradoEmSucesso("cliente")).toBe(true);
    expect(leadGeradoEmSucesso("novo")).toBe(false);
    expect(leadGeradoEmSucesso("em_contato")).toBe(false);
  });

  it("leads_gerados descartado", () => {
    expect(leadGeradoDescartado("descartado")).toBe(true);
    expect(leadGeradoDescartado("novo")).toBe(false);
  });

  it("lead onboarding em sucesso", () => {
    expect(leadOnboardingEmSucesso("reuniao_comercial", null)).toBe(true);
    expect(leadOnboardingEmSucesso("ativo", null)).toBe(true);
    expect(leadOnboardingEmSucesso("comercial", null)).toBe(true);
    expect(leadOnboardingEmSucesso("leads_potencial", null)).toBe(false);
    expect(leadOnboardingEmSucesso("leads_ativos", null)).toBe(false);
  });

  it("lead onboarding descartado quando tem motivo_perdido", () => {
    expect(leadOnboardingDescartado("não atendeu nunca")).toBe(true);
    expect(leadOnboardingDescartado(null)).toBe(false);
    expect(leadOnboardingDescartado("")).toBe(false);
  });

  it("roleVeTudo: adm/socio/coordenador veem tudo", () => {
    expect(roleVeTudo("adm")).toBe(true);
    expect(roleVeTudo("socio")).toBe(true);
    expect(roleVeTudo("coordenador")).toBe(true);
    expect(roleVeTudo("comercial")).toBe(false);
    expect(roleVeTudo("assessor")).toBe(false);
  });
});

const VAZIO = { leadsGerados: [], leads: [], attempts: [], ligacoes: [] };

describe("montarProspectosCadencia", () => {
  it("lead_gerado sem batidas e sem visita = 0/14, em cadência", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "novo", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0].totalBatidas).toBe(0);
    expect(r[0].statusCadencia).toBe("em_cadencia");
    expect(r[0].canal).toBe("ligacao");
  });

  it("visita conta como batida #1 (presencial) e canal vira rua", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Bar do Zé", status: "novo", fonte: "visita",
          visita_id: "v1", responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
    });
    expect(r[0].totalBatidas).toBe(1);
    expect(r[0].canal).toBe("rua");
  });

  it("tentativas (qualquer resultado, incl. sem_resposta) contam; ligação de saída conta; entrada não", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "em_contato", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      attempts: [
        { lead_id: null, lead_gerado_id: "g1", resultado: "sem_resposta", created_at: "2026-06-02T10:00:00Z" },
        { lead_id: null, lead_gerado_id: "g1", resultado: "recusou", created_at: "2026-06-03T10:00:00Z" },
      ],
      ligacoes: [
        { lead_id: null, lead_gerado_id: "g1", direcao: "saida", iniciada_em: "2026-06-04T10:00:00Z" },
        { lead_id: null, lead_gerado_id: "g1", direcao: "entrada", iniciada_em: "2026-06-05T10:00:00Z" },
      ],
    });
    expect(r[0].totalBatidas).toBe(3); // 2 attempts + 1 saída (entrada não conta)
    expect(r[0].ultimaBatida).toBe("2026-06-04T10:00:00Z");
  });

  it("resultado 'agendou' marca sucesso e tira da cadência", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "em_contato", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      attempts: [
        { lead_id: null, lead_gerado_id: "g1", resultado: "agendou", created_at: "2026-06-02T10:00:00Z" },
      ],
    });
    expect(r[0].temSucesso).toBe(true);
    expect(r[0].statusCadencia).toBe("convertido");
  });

  it("14 batidas sem sucesso = esgotou", () => {
    const attempts = Array.from({ length: 14 }, (_, i) => ({
      lead_id: null, lead_gerado_id: "g1", resultado: "sem_resposta",
      created_at: `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
    }));
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "em_contato", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      attempts,
    });
    expect(r[0].totalBatidas).toBe(14);
    expect(r[0].statusCadencia).toBe("esgotou");
    expect(r[0].esgotou).toBe(true);
  });

  it("merge de identidade: batidas do lead_gerado + do lead de Onboarding ligado somam num só prospecto", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "qualificado", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: "l1",
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      leads: [
        { id: "l1", nome_prospect: "Acme", stage: "leads_ativos", canal: "ligacao",
          comercial_id: "u1", motivo_perdido: null, created_at: "2026-06-01T10:00:00Z" },
      ],
      attempts: [
        { lead_id: null, lead_gerado_id: "g1", resultado: "sem_resposta", created_at: "2026-06-02T10:00:00Z" },
        { lead_id: "l1", lead_gerado_id: null, resultado: "sem_resposta", created_at: "2026-06-03T10:00:00Z" },
      ],
    });
    expect(r).toHaveLength(1); // não duplica
    expect(r[0].totalBatidas).toBe(2);
    expect(r[0].leadGeradoId).toBe("g1");
    expect(r[0].leadId).toBe("l1");
  });

  it("attempt com lead_gerado_id E lead_id do mesmo prospecto ligado conta uma vez só (dedup)", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "qualificado", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: "l1",
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      leads: [
        { id: "l1", nome_prospect: "Acme", stage: "leads_ativos", canal: "ligacao",
          comercial_id: "u1", motivo_perdido: null, created_at: "2026-06-01T10:00:00Z" },
      ],
      // O MESMO registro referencia gerado e lead: não pode contar 2x.
      attempts: [
        { lead_id: "l1", lead_gerado_id: "g1", resultado: "sem_resposta", created_at: "2026-06-02T10:00:00Z" },
      ],
      ligacoes: [
        { lead_id: "l1", lead_gerado_id: "g1", direcao: "saida", iniciada_em: "2026-06-03T10:00:00Z" },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0].totalBatidas).toBe(2); // 1 attempt + 1 ligação, sem duplicar
  });

  it("lead de Onboarding standalone (sem lead_gerado) vira prospecto próprio; convertido sai da cadência", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leads: [
        { id: "l9", nome_prospect: "Solo", stage: "reuniao_comercial", canal: "rua",
          comercial_id: "u1", motivo_perdido: null, created_at: "2026-06-01T10:00:00Z" },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0].leadGeradoId).toBeNull();
    expect(r[0].leadId).toBe("l9");
    expect(r[0].canal).toBe("rua");
    expect(r[0].temSucesso).toBe(true);
  });

  it("descartado: leads_gerados status descartado", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "descartado", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
    });
    expect(r[0].statusCadencia).toBe("descartado");
    expect(r[0].descartado).toBe(true);
  });

  it("13 batidas ainda é em_cadencia (fronteira abaixo do esgotamento)", () => {
    const attempts = Array.from({ length: 13 }, (_, i) => ({
      lead_id: null, lead_gerado_id: "g1", resultado: "sem_resposta",
      created_at: `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
    }));
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "em_contato", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      attempts,
    });
    expect(r[0].totalBatidas).toBe(13);
    expect(r[0].esgotou).toBe(false);
    expect(r[0].statusCadencia).toBe("em_cadencia");
  });

  it("descartado via motivo_perdido em lead de Onboarding standalone", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leads: [
        { id: "l5", nome_prospect: "Perdido", stage: "leads_ativos", canal: "ligacao",
          comercial_id: "u1", motivo_perdido: "não atende há 1 mês", created_at: "2026-06-01T10:00:00Z" },
      ],
    });
    expect(r[0].descartado).toBe(true);
    expect(r[0].statusCadencia).toBe("descartado");
  });

  it("descartado tem prioridade sobre convertido (status descartado + attempt agendou)", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "descartado", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      attempts: [
        { lead_id: null, lead_gerado_id: "g1", resultado: "agendou", created_at: "2026-06-02T10:00:00Z" },
      ],
    });
    expect(r[0].descartado).toBe(true);
    expect(r[0].temSucesso).toBe(true);
    expect(r[0].statusCadencia).toBe("descartado");
  });
});
