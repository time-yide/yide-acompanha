import { EXPENSE_CATEGORIAS, EXPENSE_TIPOS, type ExpenseCategoria, type ExpenseTipo } from "./schema";

export interface ImportRow {
  descricao: string;
  categoria: ExpenseCategoria;
  valor: number;
  tipo: ExpenseTipo;
  mes_referencia: string | null;
  inicio_mes: string | null;
  fim_mes: string | null;
  notas: string | null;
  /** índice da linha original (1-based) pra mostrar erro pro usuário */
  linha: number;
}

export interface ImportError {
  linha: number;
  raw: string;
  mensagem: string;
}

export interface ImportResult {
  rows: ImportRow[];
  errors: ImportError[];
}

const HEADER_TOKENS = ["descricao", "descrição", "categoria", "valor", "tipo"];
const MONTH_RE = /^\d{4}-\d{2}$/;

function splitFields(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((s) => s.trim());
  return line.split(",").map((s) => s.trim());
}

export function parseBulkExpenses(text: string): ImportResult {
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  const lines = text.split(/\r?\n/);

  let isFirstNonEmpty = true;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const linhaNum = i + 1;
    const fields = splitFields(trimmed);

    // Pula header
    if (isFirstNonEmpty) {
      isFirstNonEmpty = false;
      const lower = fields.map((f) => f.toLowerCase());
      if (HEADER_TOKENS.some((tok) => lower.includes(tok))) continue;
    }

    if (fields.length < 4) {
      errors.push({ linha: linhaNum, raw, mensagem: "Mínimo 4 colunas: descricao, categoria, valor, tipo" });
      continue;
    }

    const [descricao, categoria, valorStr, tipo, mesRef, inicio, fim, notas] = fields;

    if (!descricao || descricao.length < 2) {
      errors.push({ linha: linhaNum, raw, mensagem: "Descrição muito curta" });
      continue;
    }
    if (!EXPENSE_CATEGORIAS.includes(categoria as ExpenseCategoria)) {
      errors.push({
        linha: linhaNum, raw,
        mensagem: `Categoria inválida (use: ${EXPENSE_CATEGORIAS.join(", ")})`,
      });
      continue;
    }
    const valor = Number(valorStr);
    if (!Number.isFinite(valor) || valor < 0) {
      errors.push({ linha: linhaNum, raw, mensagem: "Valor inválido" });
      continue;
    }
    if (!EXPENSE_TIPOS.includes(tipo as ExpenseTipo)) {
      errors.push({ linha: linhaNum, raw, mensagem: 'Tipo deve ser "fixa" ou "avulsa"' });
      continue;
    }

    const mes_referencia = mesRef && MONTH_RE.test(mesRef) ? mesRef : null;
    if (tipo === "avulsa" && !mes_referencia) {
      errors.push({ linha: linhaNum, raw, mensagem: "Avulsa exige mes_referencia (formato YYYY-MM)" });
      continue;
    }
    if (tipo === "fixa" && mes_referencia) {
      errors.push({ linha: linhaNum, raw, mensagem: "Fixa não aceita mes_referencia" });
      continue;
    }

    const inicio_mes = inicio && MONTH_RE.test(inicio) ? inicio : null;
    const fim_mes = fim && MONTH_RE.test(fim) ? fim : null;

    if (tipo !== "fixa" && (inicio_mes || fim_mes)) {
      errors.push({ linha: linhaNum, raw, mensagem: "inicio_mes/fim_mes só pra fixa" });
      continue;
    }
    if (fim_mes && inicio_mes && fim_mes <= inicio_mes) {
      errors.push({ linha: linhaNum, raw, mensagem: "fim_mes deve ser maior que inicio_mes" });
      continue;
    }

    rows.push({
      descricao,
      categoria: categoria as ExpenseCategoria,
      valor,
      tipo: tipo as ExpenseTipo,
      mes_referencia,
      inicio_mes,
      fim_mes,
      notas: notas?.trim() || null,
      linha: linhaNum,
    });
  }

  return { rows, errors };
}
