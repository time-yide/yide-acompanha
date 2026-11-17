export const OBJETIVOS = [
  "Mais clientes no WhatsApp",
  "Vender pela internet (loja virtual ou Mercado Livre)",
  "Aparecer no Google",
  "Organizar o atendimento e as vendas (CRM)",
  "Conteúdo e vídeos para as redes",
];

interface Respostas { nome: string; empresa: string; cidade: string; objetivo: string }

export function montarMensagemDiagnostico(r: Respostas): { ok: true; texto: string } | { ok: false; erro: string } {
  const nome = r.nome.trim().slice(0, 80);
  const empresa = r.empresa.trim().slice(0, 120);
  if (!nome || !empresa) return { ok: false, erro: "Preencha seu nome e a empresa." };
  const linhas = ["Olá! Quero um diagnóstico gratuito da Yide.", `Nome: ${nome}`, `Empresa: ${empresa}`];
  const cidade = r.cidade.trim().slice(0, 80);
  const objetivo = r.objetivo.trim().slice(0, 120);
  if (cidade) linhas.push(`Cidade: ${cidade}`);
  if (objetivo) linhas.push(`Objetivo: ${objetivo}`);
  return { ok: true, texto: linhas.join("\n") };
}
