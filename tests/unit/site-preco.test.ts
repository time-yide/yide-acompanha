import { describe, expect, it } from "vitest";
import { PRECO_A_PARTIR, perguntaPreco } from "@/lib/site/preco";
import { FAQ_GERAL } from "@/lib/site/faq-geral";

describe("preço a partir de", () => {
  it("monta a pergunta de preço do serviço com o valor de entrada", () => {
    const p = perguntaPreco("Gestão de tráfego");
    expect(p.pergunta).toBe("Quanto custa gestão de tráfego com a Yide?");
    expect(p.resposta).toContain(`a partir de ${PRECO_A_PARTIR}`);
    expect(p.resposta).toContain("verba de anúncios é paga à parte");
  });

  it("o FAQ geral cita o preço de entrada", () => {
    const f = FAQ_GERAL.find((x) => x.pergunta === "Quanto custa contratar a Yide?");
    expect(f?.resposta).toContain(PRECO_A_PARTIR);
  });
});
