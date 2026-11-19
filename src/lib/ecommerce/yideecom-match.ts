// Módulo puro (sem server-only): casa o que vem do Yide Ecom com os clientes daqui.
import type { AnuncioRow } from "./queries";

/** Linha da API /api/external/publicados do Yide Ecom. */
export interface PublicadoYideEcom {
  cliente_id: string;
  cliente_nome: string;
  data: string; // AAAA-MM-DD
  marketplace: string; // mercado_livre | tray
  quantidade: number;
}

/** Nome comparável: sem acento, minúsculo, só letras/números com 1 espaço. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Liga cada cliente do Yide Ecom ao cliente e-commerce daqui com o MESMO nome
 * (ignorando acento/maiúscula/pontuação). Vira linha da lista sem assessor
 * (origem "yideecom", não editável). Os que não batem voltam em `semCliente`
 * pra tela avisar quem precisa ter o nome acertado.
 */
export function casarPublicados(
  publicados: PublicadoYideEcom[],
  clientes: { id: string; nome: string }[],
): { rows: AnuncioRow[]; semCliente: string[] } {
  const porNome = new Map<string, { id: string; nome: string }>();
  for (const c of clientes) {
    const k = normalizarNome(c.nome);
    if (k && !porNome.has(k)) porNome.set(k, c);
  }

  const rows: AnuncioRow[] = [];
  const semCliente = new Set<string>();
  for (const p of publicados) {
    if (!p.quantidade) continue;
    const cliente = porNome.get(normalizarNome(p.cliente_nome));
    if (!cliente) {
      semCliente.add(p.cliente_nome);
      continue;
    }
    rows.push({
      id: `yideecom:${p.cliente_id}:${p.data}:${p.marketplace}`,
      origem: "yideecom",
      data: p.data,
      quantidade: p.quantidade,
      marketplace: p.marketplace,
      observacao: null,
      colaborador_id: null,
      colaborador_nome: null,
      colaborador_avatar_url: null,
      client_id: cliente.id,
      client_nome: cliente.nome,
      created_at: `${p.data}T00:00:00-03:00`,
    });
  }
  return { rows, semCliente: [...semCliente].sort((a, b) => a.localeCompare(b, "pt-BR")) };
}

/** Junta manuais + Yide Ecom, mais recentes primeiro. */
export function juntarAnuncios(manuais: AnuncioRow[], auto: AnuncioRow[]): AnuncioRow[] {
  return [...manuais, ...auto].sort(
    (a, b) => b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at),
  );
}
