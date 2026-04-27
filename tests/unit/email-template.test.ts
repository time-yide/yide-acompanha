import { describe, it, expect } from "vitest";
import { renderNotificationEmail } from "@/lib/email/templates/notification";

describe("renderNotificationEmail", () => {
  it("escapa HTML em titulo e mensagem (segurança)", () => {
    const { html } = renderNotificationEmail({
      recipientName: "Ana",
      titulo: "<script>alert('xss')</script>",
      mensagem: "<img src=x onerror=alert(1)>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror=alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("inclui CTA quando ctaUrl é fornecido", () => {
    const { html } = renderNotificationEmail({
      recipientName: "Bruno",
      titulo: "Tarefa atribuída",
      mensagem: "Nova tarefa pra você",
      ctaUrl: "https://yideacompanha.com/tarefas/abc",
      ctaLabel: "Ver tarefa",
    });
    expect(html).toContain("https://yideacompanha.com/tarefas/abc");
    expect(html).toContain("Ver tarefa");
  });

  it("não inclui CTA quando ctaUrl está ausente", () => {
    const { html } = renderNotificationEmail({
      recipientName: "Carla",
      titulo: "Lembrete",
      mensagem: "Algo aconteceu",
    });
    expect(html).not.toMatch(/<a [^>]*href=/);
  });

  it("plain text inclui link absoluto quando há CTA", () => {
    const { text } = renderNotificationEmail({
      recipientName: "Diego",
      titulo: "Marco zero amanhã",
      mensagem: "Reunião com Cliente X",
      ctaUrl: "https://yideacompanha.com/onboarding/xyz",
    });
    expect(text).toContain("https://yideacompanha.com/onboarding/xyz");
    expect(text).toContain("Marco zero amanhã");
  });
});
