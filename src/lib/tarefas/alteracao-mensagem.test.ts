import { describe, it, expect } from "vitest";
import { destinatariosAlteracao, mensagemWppAlteracao } from "./alteracao-mensagem";

describe("destinatariosAlteracao", () => {
  it("tira vazios, duplicados e quem disparou a ação", () => {
    expect(destinatariosAlteracao(["a", null, "b", "a", undefined, "actor"], "actor")).toEqual(["a", "b"]);
  });
  it("sem actor (cliente pelo link público) mantém todos", () => {
    expect(destinatariosAlteracao(["a", "b"], null)).toEqual(["a", "b"]);
  });
});

describe("mensagemWppAlteracao", () => {
  const base = { titulo: "Reels promo", clienteNome: "Padaria X", url: "https://app/tarefas/1" };

  it("usa o primeiro nome, cliente, motivo e link", () => {
    const msg = mensagemWppAlteracao({ ...base, nome: "Icaro Souza", motivo: "Trocar a trilha" });
    expect(msg).toContain("Icaro, a tarefa *Reels promo* (Padaria X) voltou pra alteração.");
    expect(msg).toContain("📝 *O que mudar:* Trocar a trilha");
    expect(msg).toContain("🔗 https://app/tarefas/1");
  });

  it("sem motivo não mostra a linha do que mudar", () => {
    const msg = mensagemWppAlteracao({ ...base, nome: "Icaro", motivo: null });
    expect(msg).not.toContain("O que mudar");
  });

  it("sem nome nem cliente continua legível", () => {
    const msg = mensagemWppAlteracao({ ...base, nome: null, clienteNome: null, motivo: "" });
    expect(msg).toContain("A tarefa *Reels promo* voltou pra alteração.");
  });

  it("corta motivo muito longo", () => {
    const msg = mensagemWppAlteracao({ ...base, nome: "Icaro", motivo: "x".repeat(800) });
    expect(msg).toContain("x".repeat(497) + "...");
    expect(msg).not.toContain("x".repeat(498));
  });
});
