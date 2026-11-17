// SERVER ONLY: não importar de componente client (usa a chave da service account).
import { createSign } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { resolveDriveConfig, type DriveAuthConfig, type DriveConfig } from "./config";
import { escapeDriveQuery, driveFolderUrl } from "./naming";

/**
 * Cliente mínimo da API do Google Drive v3 via fetch — sem `googleapis`
 * (pacote enorme) só pra listar/criar pasta e abrir sessão de upload.
 *
 * Todas as chamadas mandam `supportsAllDrives=true`, senão a API não enxerga
 * pastas dentro de Drive compartilhado.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export function getDriveConfig(): DriveConfig | null {
  return resolveDriveConfig(getServerEnv());
}

export function driveConfigurado(): boolean {
  return getDriveConfig() !== null;
}

function requireConfig(): DriveConfig {
  const cfg = getDriveConfig();
  if (!cfg) throw new Error("GOOGLE_DRIVE_NAO_CONFIGURADO");
  return cfg;
}

// ─── Access token (cache em memória da instância) ───────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function fetchToken(auth: DriveAuthConfig): Promise<{ access_token: string; expires_in: number }> {
  let body: URLSearchParams;
  if (auth.tipo === "oauth") {
    body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
      refresh_token: auth.refreshToken,
    });
  } else {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(JSON.stringify({
      iss: auth.credentials.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }));
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const signature = base64url(signer.sign(auth.credentials.private_key));
    body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    });
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`DRIVE_AUTH_FALHOU: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as { access_token: string; expires_in: number };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token;
  const { auth } = requireConfig();
  const t = await fetchToken(auth);
  cachedToken = { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
  return t.access_token;
}

async function driveJson<T>(path: string, init: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${DRIVE_API}${path}`);
  url.searchParams.set("supportsAllDrives", "true");
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`DRIVE_API_FALHOU ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// ─── Pastas ─────────────────────────────────────────────────────────────────

interface DriveFileList {
  files?: Array<{ id: string; name: string }>;
  nextPageToken?: string;
}

async function listar(q: string, pageToken?: string): Promise<DriveFileList> {
  return driveJson<DriveFileList>("/files", {
    query: {
      q,
      fields: "nextPageToken, files(id, name)",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      corpora: "allDrives",
      ...(pageToken ? { pageToken } : {}),
    },
  });
}

export async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  const q = `name='${escapeDriveQuery(name)}' and '${escapeDriveQuery(parentId)}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;
  const found = await listar(q);
  if (found.files?.length) return found.files[0].id;

  const created = await driveJson<{ id: string }>("/files", {
    method: "POST",
    query: { fields: "id" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  return created.id;
}

export interface FolderHierarchy {
  folderId: string;
  folderUrl: string;
  mesFolderUrl: string;
}

/** Garante Raiz / Cliente / Mês / Categoria e devolve a pasta da categoria. */
export async function ensureFolderHierarchy(
  pastaCliente: string,
  pastaMes: string,
  pastaCategoria: string,
): Promise<FolderHierarchy> {
  const { rootFolderId } = requireConfig();
  const clienteId = await findOrCreateFolder(pastaCliente, rootFolderId);
  const mesId = await findOrCreateFolder(pastaMes, clienteId);
  const catId = await findOrCreateFolder(pastaCategoria, mesId);
  return { folderId: catId, folderUrl: driveFolderUrl(catId), mesFolderUrl: driveFolderUrl(mesId) };
}

/** Nomes dos arquivos (não-pasta) já existentes na pasta — pra numerar em sequência. */
export async function listFileNamesInFolder(folderId: string): Promise<string[]> {
  const q = `'${escapeDriveQuery(folderId)}' in parents and mimeType!='${FOLDER_MIME}' and trashed=false`;
  const nomes: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await listar(q, pageToken);
    for (const f of page.files ?? []) nomes.push(f.name);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return nomes;
}

// ─── Upload resumável ───────────────────────────────────────────────────────

/**
 * Abre uma sessão de upload resumável e devolve a URI da sessão. O navegador
 * faz o PUT do arquivo direto nela (o vídeo não passa pela função da Vercel).
 *
 * `origin` precisa ser a origem do navegador que vai fazer o PUT: o Google
 * só libera CORS na URI da sessão pra origem informada na abertura.
 */
export async function initResumableUpload(args: {
  fileName: string;
  mimeType: string;
  folderId: string;
  fileSize: number;
  origin: string;
}): Promise<string> {
  const token = await getAccessToken();
  const url = new URL(`${DRIVE_UPLOAD_API}/files`);
  url.searchParams.set("uploadType", "resumable");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id,name,webViewLink");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": args.mimeType,
      "X-Upload-Content-Length": String(args.fileSize),
      Origin: args.origin,
    },
    body: JSON.stringify({ name: args.fileName, parents: [args.folderId] }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`DRIVE_RESUMABLE_INIT_FALHOU: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const uploadUri = res.headers.get("location");
  if (!uploadUri) throw new Error("DRIVE_RESUMABLE_SEM_URI");
  return uploadUri;
}

// ─── Conferência pós-upload ─────────────────────────────────────────────────

export interface DriveFileInfo {
  id: string;
  name: string;
  parents: string[];
  size: number | null;
  trashed: boolean;
}

/** Metadados de um arquivo (null se não existir / sem acesso). */
export async function getDriveFile(fileId: string): Promise<DriveFileInfo | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(fileId)) return null;
  try {
    const f = await driveJson<{ id: string; name: string; parents?: string[]; size?: string; trashed?: boolean }>(
      `/files/${fileId}`,
      { query: { fields: "id,name,parents,size,trashed" } },
    );
    return {
      id: f.id,
      name: f.name,
      parents: f.parents ?? [],
      size: f.size ? Number(f.size) : null,
      trashed: !!f.trashed,
    };
  } catch {
    return null;
  }
}
