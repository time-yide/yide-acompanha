export interface ParsedRow {
  line_number: number;
  nome: string;
  valor_mensal: number;
  servico_contratado: string | null;
}

export interface ParseError {
  line_number: number;
  raw_line: string;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
}

const HEADER_REGEX = /^\s*nome\b/i;

function detectSeparator(line: string): "\t" | "," {
  if (line.includes("\t")) return "\t";
  return ",";
}

function parseValor(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseBulkImport(text: string): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (rows.length === 0 && errors.length === 0 && HEADER_REGEX.test(trimmed)) continue;

    const sep = detectSeparator(raw);
    const cols = raw.split(sep).map((c) => c.trim());
    const [nomeRaw, valorRaw, servicoRaw] = cols;

    if (!nomeRaw || nomeRaw.length < 2) {
      errors.push({ line_number: i + 1, raw_line: raw, message: "Nome ausente ou muito curto" });
      continue;
    }

    const valor = parseValor(valorRaw ?? "");
    if (valor === null || valor < 0) {
      errors.push({ line_number: i + 1, raw_line: raw, message: `Valor inválido: "${valorRaw}"` });
      continue;
    }

    rows.push({
      line_number: i + 1,
      nome: nomeRaw,
      valor_mensal: valor,
      servico_contratado: servicoRaw && servicoRaw.length > 0 ? servicoRaw : null,
    });
  }

  return { rows, errors };
}
