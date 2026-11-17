/**
 * Regras puras (sem rede) do upload de vídeos pro Google Drive:
 * nomes de pasta (Cliente → Mês → Categoria), nome sequencial dos arquivos,
 * validação de tipo/tamanho e escolha do link que vai pra entrega de captação.
 *
 * Importável no client e no server — não pode depender de env nem de fetch.
 */

export const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export const CATEGORIAS_VIDEO = [
  { value: "reels", pasta: "Reels" },
  { value: "stories", pasta: "Stories" },
  { value: "feed", pasta: "Feed" },
  { value: "institucional", pasta: "Institucional" },
  { value: "depoimento", pasta: "Depoimento" },
  { value: "bruto", pasta: "Brutos" },
  { value: "outro", pasta: "Outros" },
] as const;

export type CategoriaVideo = (typeof CATEGORIAS_VIDEO)[number]["value"];

export const CATEGORIA_VALUES = CATEGORIAS_VIDEO.map((c) => c.value) as [
  CategoriaVideo,
  ...CategoriaVideo[],
];

/** Nome da pasta de categoria ("reels" → "Reels"). */
export function nomePastaCategoria(categoria: CategoriaVideo): string {
  const found = CATEGORIAS_VIDEO.find((c) => c.value === categoria);
  if (!found) throw new Error(`Categoria inválida: ${categoria}`);
  return found.pasta;
}

/**
 * Nome da pasta do mês a partir de uma data "YYYY-MM-DD" (ex.: data da
 * captação). Usa a string direto, sem `new Date()`, pra não escorregar de mês
 * por fuso (dia 1º à meia-noite em Cuiabá ainda é o mês anterior em UTC-…).
 */
export function nomePastaMes(dataIso: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(dataIso);
  if (!m) throw new Error(`Data inválida: ${dataIso}`);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) throw new Error(`Data inválida: ${dataIso}`);
  return `${MESES_PT[mes - 1]} ${m[1]}`;
}

/**
 * Nome da pasta do cliente. Tira espaços duplicados e troca "/" (que no Drive
 * é permitido mas confunde quem lê o caminho "Cliente / Mês / Categoria").
 */
export function nomePastaCliente(nome: string): string {
  const limpo = nome.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim();
  return limpo.length > 0 ? limpo.slice(0, 200) : "Sem nome";
}

/** Escapa um valor pra usar entre aspas simples na query `q` do Drive. */
export function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Extensões aceitas → MIME enviado pro Drive (allowlist). */
const VIDEO_MIME_POR_EXTENSAO = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
  "3gp": "video/3gpp",
} as const;

type ExtensaoVideo = keyof typeof VIDEO_MIME_POR_EXTENSAO;

export const VIDEO_EXTENSOES = Object.keys(VIDEO_MIME_POR_EXTENSAO) as ExtensaoVideo[];

function extensaoBruta(nome: string): string | null {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(nome.trim());
  return m ? m[1].toLowerCase() : null;
}

function isExtensaoVideo(ext: string | null): ext is ExtensaoVideo {
  return ext !== null && Object.prototype.hasOwnProperty.call(VIDEO_MIME_POR_EXTENSAO, ext);
}

/**
 * Extensão canônica (da allowlist) pro nome no Drive; "mp4" quando o arquivo
 * não tem extensão de vídeo conhecida. Nunca repassa extensão arbitrária.
 */
export function extensaoArquivo(nome: string): ExtensaoVideo {
  const ext = extensaoBruta(nome);
  return isExtensaoVideo(ext) ? ext : "mp4";
}

/**
 * Só aceita arquivo com extensão de vídeo da allowlist. O MIME do navegador,
 * se vier, tem que ser `video/*` (ou vazio/octet-stream, comum em .mts/.mkv).
 */
export function isArquivoVideo(nome: string, mime: string | null | undefined): boolean {
  if (!isExtensaoVideo(extensaoBruta(nome))) return false;
  if (!mime || mime === "application/octet-stream") return true;
  return mime.startsWith("video/");
}

/** MIME enviado pro Drive: sempre o da allowlist pela extensão (ignora o do navegador). */
export function mimeVideo(nome: string): string {
  return VIDEO_MIME_POR_EXTENSAO[extensaoArquivo(nome)];
}

export const DRIVE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB por arquivo
export const DRIVE_UPLOAD_MAX_ARQUIVOS = 30; // por envio

/**
 * Nome sequencial do arquivo dentro da pasta da categoria:
 * `video-01.mp4`, `video-02.mov`… (2 dígitos mínimo, cresce se passar de 99).
 */
export function nomeArquivoDrive(sequencia: number, nomeOriginal: string): string {
  if (!Number.isInteger(sequencia) || sequencia < 1) {
    throw new Error(`Sequência inválida: ${sequencia}`);
  }
  return `video-${String(sequencia).padStart(2, "0")}.${extensaoArquivo(nomeOriginal)}`;
}

/**
 * Próxima sequência livre a partir dos nomes já existentes na pasta. Usa o
 * maior `video-NN` (e não a contagem) pra não repetir número quando alguém
 * apagou ou renomeou arquivo no meio.
 */
export function proximaSequencia(nomesExistentes: readonly string[]): number {
  let max = 0;
  for (const nome of nomesExistentes) {
    const m = /^video-(\d+)\./i.exec(nome);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export const DRIVE_FOLDER_URL_RE = /^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+$/;

/**
 * Só devolve a URL se for exatamente uma pasta do Drive — pra usar em `href`
 * sem risco de `javascript:` ou link pra outro domínio vindo do banco.
 */
export function hrefPastaDrive(url: string | null | undefined): string | null {
  return typeof url === "string" && DRIVE_FOLDER_URL_RE.test(url) ? url : null;
}

/**
 * Link que vai no campo "Link do Google Drive" da entrega de captação:
 * se tudo foi pra uma categoria só, a pasta dela; se foi pra mais de uma,
 * a pasta do mês (que contém as categorias).
 */
export function escolherLinkEntrega(
  envios: ReadonlyArray<{ folderUrl: string; mesFolderUrl: string }>,
): string | null {
  if (envios.length === 0) return null;
  const pastas = new Set(envios.map((e) => e.folderUrl));
  if (pastas.size === 1) return envios[0].folderUrl;
  return envios[envios.length - 1].mesFolderUrl;
}
