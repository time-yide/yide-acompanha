// Módulo puro (sem server-only): formatos da API do Yide Ecom e as contas da aba Vendas.
import { normalizarNome } from "./yideecom-match";

export type CanalYideEcom = "mercado_livre" | "tray";

/** Linha de /api/external/vendas do Yide Ecom. */
export interface VendasClienteYideEcom {
  cliente_id: string;
  cliente_nome: string;
  canais: {
    marketplace: CanalYideEcom;
    erro: string | null;
    pedidos: number;
    cancelados: number;
    unidades: number;
    faturamento: number;
    tarifas: number;
    lucro: number;
    parcial: boolean;
    por_dia: { data: string; faturamento: number; pedidos: number }[];
    produtos: { titulo: string; pedidos: number; unidades: number; faturamento: number }[];
  }[];
}

/** Linha de /api/external/sugestoes do Yide Ecom. */
export interface SugestoesClienteYideEcom {
  cliente_id: string;
  cliente_nome: string;
  alertas: {
    tipo: string;
    rotulo: string;
    quantidade: number;
    novos_hoje: number;
    exemplos: { titulo: string; mensagem: string; link: string | null; desde: string }[];
  }[];
  anuncios: { titulo: string; link: string | null; nota: number; melhorar: string[] }[];
}

export interface VendasFiltro {
  clienteId: string | null; // id do cliente no Yide Ecom
  canal: CanalYideEcom | null;
}

export interface VendasResumo {
  faturamento: number;
  pedidos: number;
  unidades: number;
  cancelados: number;
  tarifas: number;
  lucro: number;
  ticketMedio: number;
  parcial: boolean;
  porDia: { data: string; faturamento: number; pedidos: number }[];
  porCliente: {
    clienteId: string;
    clienteNome: string;
    canal: CanalYideEcom;
    faturamento: number;
    pedidos: number;
    unidades: number;
    lucro: number;
    ticketMedio: number;
    erro: string | null;
  }[];
  produtos: { titulo: string; clienteNome: string; canal: CanalYideEcom; pedidos: number; unidades: number; faturamento: number }[];
  erros: { clienteNome: string; canal: CanalYideEcom; erro: string }[];
}

const TOP_PRODUTOS = 15;

/** Soma as vendas do filtro: totais, por dia (todos os dias do período), por cliente/canal e top produtos. */
export function resumirVendas(
  clientes: VendasClienteYideEcom[],
  filtro: VendasFiltro,
  periodo: { de: string; ate: string },
): VendasResumo {
  const r: VendasResumo = {
    faturamento: 0,
    pedidos: 0,
    unidades: 0,
    cancelados: 0,
    tarifas: 0,
    lucro: 0,
    ticketMedio: 0,
    parcial: false,
    porDia: [],
    porCliente: [],
    produtos: [],
    erros: [],
  };
  const dias = new Map<string, { faturamento: number; pedidos: number }>();
  const n = Math.min(diasNoPeriodo(periodo.de, periodo.ate) || 0, MAX_DIAS_VENDAS);
  for (let i = 0, d = periodo.de; i < n; i++, d = proximoDia(d)) dias.set(d, { faturamento: 0, pedidos: 0 });

  for (const c of clientes) {
    if (filtro.clienteId && c.cliente_id !== filtro.clienteId) continue;
    for (const ch of c.canais ?? []) {
      if (filtro.canal && ch.marketplace !== filtro.canal) continue;
      if (ch.erro) r.erros.push({ clienteNome: c.cliente_nome, canal: ch.marketplace, erro: ch.erro });
      r.faturamento += ch.faturamento;
      r.pedidos += ch.pedidos;
      r.unidades += ch.unidades;
      r.cancelados += ch.cancelados;
      r.tarifas += ch.tarifas;
      r.lucro += ch.lucro;
      r.parcial ||= ch.parcial;
      for (const d of ch.por_dia ?? []) {
        const dia = dias.get(d.data);
        if (!dia) continue;
        dia.faturamento += d.faturamento;
        dia.pedidos += d.pedidos;
      }
      r.porCliente.push({
        clienteId: c.cliente_id,
        clienteNome: c.cliente_nome,
        canal: ch.marketplace,
        faturamento: ch.faturamento,
        pedidos: ch.pedidos,
        unidades: ch.unidades,
        lucro: ch.lucro,
        ticketMedio: ch.pedidos ? ch.faturamento / ch.pedidos : 0,
        erro: ch.erro,
      });
      for (const p of ch.produtos ?? []) {
        r.produtos.push({ ...p, clienteNome: c.cliente_nome, canal: ch.marketplace });
      }
    }
  }

  r.ticketMedio = r.pedidos ? r.faturamento / r.pedidos : 0;
  r.porDia = [...dias.entries()].map(([data, v]) => ({ data, ...v }));
  r.porCliente.sort((a, b) => b.faturamento - a.faturamento || a.clienteNome.localeCompare(b.clienteNome, "pt-BR"));
  r.produtos = r.produtos.sort((a, b) => b.faturamento - a.faturamento).slice(0, TOP_PRODUTOS);
  return r;
}

function proximoDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function parseCanal(v: string | undefined): CanalYideEcom | null {
  return v === "mercado_livre" || v === "tray" ? v : null;
}

/** Opções do filtro de cliente: os clientes que o Yide Ecom devolveu, em ordem alfabética. */
export function opcoesClientes(lista: { cliente_id: string; cliente_nome: string }[]) {
  return lista
    .map((c) => ({ id: c.cliente_id, nome: c.cliente_nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export const formatarReais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v >= 1000 ? 0 : 2 });

/**
 * Só os clientes do Yide Ecom com cliente e-commerce de MESMO nome nesta organização
 * (mesma regra dos anúncios publicados). Os outros voltam em `semCliente` para o aviso.
 */
export function soClientesDaOrg<T extends { cliente_nome: string }>(
  lista: T[],
  clientes: { nome: string }[],
): { dados: T[]; semCliente: string[] } {
  const nomes = new Set(clientes.map((c) => normalizarNome(c.nome)).filter(Boolean));
  const dados: T[] = [];
  const semCliente: string[] = [];
  for (const c of lista) {
    if (nomes.has(normalizarNome(c.cliente_nome))) dados.push(c);
    else semCliente.push(c.cliente_nome);
  }
  return { dados, semCliente: semCliente.sort((a, b) => a.localeCompare(b, "pt-BR")) };
}

/** Link externo só se for https (vem de outro sistema: nada de javascript: etc.). */
export function linkSeguro(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    return new URL(link).protocol === "https:" ? link : null;
  } catch {
    return null;
  }
}

export const MAX_DIAS_VENDAS = 93;

/** Data AAAA-MM-DD que existe no calendário (31/02 não). */
function dataValida(iso: string): boolean {
  const t = Date.parse(`${iso}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === iso;
}

/** Dias entre de e ate (inclusive); NaN se alguma data não existe. */
export function diasNoPeriodo(de: string, ate: string): number {
  if (!dataValida(de) || !dataValida(ate)) return NaN;
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000) + 1;
}
