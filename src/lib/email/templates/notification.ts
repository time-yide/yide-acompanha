interface TemplateArgs {
  recipientName: string;
  titulo: string;
  mensagem: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"'=]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "=": "&#61;",
  }[c]!));
}

export function renderNotificationEmail(args: TemplateArgs): { html: string; text: string } {
  const { recipientName, titulo, mensagem, ctaUrl, ctaLabel } = args;
  const safeTitulo = escapeHtml(titulo);
  const safeMensagem = escapeHtml(mensagem);
  const safeName = escapeHtml(recipientName);
  const safeLabel = escapeHtml(ctaLabel ?? "Acessar");

  const text = `Olá ${recipientName},

${titulo}
${mensagem}
${ctaUrl ? `\nAcessar: ${ctaUrl}\n` : ""}
— Yide Acompanha`;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #0a0a0f;">
  <div style="font-size: 18px; font-weight: 600; color: #2BA39C;">Yide Acompanha</div>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">Olá ${safeName},</p>
  <h1 style="margin: 0 0 12px 0; font-size: 18px;">${safeTitulo}</h1>
  <p style="margin: 0 0 20px 0; line-height: 1.5;">${safeMensagem}</p>
  ${ctaUrl
    ? `<a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #3DC4BC, #2BA39C); color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 500;">${safeLabel}</a>`
    : ""}
  <p style="margin-top: 32px; color: #94a3b8; font-size: 12px;">
    Você está recebendo este email porque é colaborador da Yide Digital.
    Para ajustar suas preferências de notificação, acesse o sistema.
  </p>
</div>`;

  return { html, text };
}
