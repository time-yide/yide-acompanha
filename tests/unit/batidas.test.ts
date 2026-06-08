// tests/unit/batidas.test.ts
import { describe, it, expect } from "vitest";
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
