import { google, type drive_v3 } from "googleapis";
import { JWT } from "google-auth-library";
import { getServerEnv } from "@/lib/env";

let authInstance: JWT | null = null;
let driveInstance: drive_v3.Drive | null = null;

function getCredentials() {
  const env = getServerEnv();
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.GOOGLE_DRIVE_ROOT_FOLDER_ID) {
    return null;
  }
  return {
    serviceAccount: JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as {
      client_email: string;
      private_key: string;
    },
    rootFolderId: env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
  };
}

export function driveConfigurado(): boolean {
  return getCredentials() !== null;
}

export function getRootFolderId(): string {
  const creds = getCredentials();
  if (!creds) throw new Error("GOOGLE_DRIVE_NAO_CONFIGURADO");
  return creds.rootFolderId;
}

function getAuth(): JWT {
  if (authInstance) return authInstance;
  const creds = getCredentials();
  if (!creds) throw new Error("GOOGLE_DRIVE_NAO_CONFIGURADO");
  authInstance = new JWT({
    email: creds.serviceAccount.client_email,
    key: creds.serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return authInstance;
}

function getDrive(): drive_v3.Drive {
  if (driveInstance) return driveInstance;
  driveInstance = google.drive({ version: "v3", auth: getAuth() });
  return driveInstance;
}

export async function findOrCreateFolder(
  name: string,
  parentId: string,
): Promise<string> {
  const drive = getDrive();
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = `name='${escaped}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await drive.files.list({ q, fields: "files(id)", pageSize: 1 });
  if (list.data.files?.length) return list.data.files[0].id!;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  return created.data.id!;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Cria a hierarquia Cliente / Mês / Categoria e retorna o folder ID final. */
export async function ensureFolderHierarchy(
  clientName: string,
  mesReferencia: Date,
  categoria: string,
): Promise<{ folderId: string; folderUrl: string }> {
  const rootId = getRootFolderId();
  const clientFolderId = await findOrCreateFolder(clientName, rootId);
  const mesLabel = `${MESES[mesReferencia.getMonth()]} ${mesReferencia.getFullYear()}`;
  const mesFolderId = await findOrCreateFolder(mesLabel, clientFolderId);
  const catFolderId = await findOrCreateFolder(categoria, mesFolderId);

  return {
    folderId: catFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${catFolderId}`,
  };
}

/**
 * Inicia um upload resumável no Google Drive.
 * Retorna a URI que o browser pode usar pra PUT direto (sem auth extra).
 */
export async function initResumableUpload(
  fileName: string,
  mimeType: string,
  folderId: string,
  fileSize: number,
): Promise<string> {
  const auth = getAuth();
  const token = await auth.getAccessToken();

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(fileSize),
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DRIVE_RESUMABLE_INIT_FALHOU: ${res.status} ${body}`);
  }

  const uploadUri = res.headers.get("location");
  if (!uploadUri) throw new Error("DRIVE_RESUMABLE_SEM_URI");
  return uploadUri;
}

/** Conta arquivos não-pasta na pasta (pra numerar sequencialmente). */
export async function countFilesInFolder(folderId: string): Promise<number> {
  const drive = getDrive();
  const q = `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`;
  const list = await drive.files.list({ q, fields: "files(id)", pageSize: 1000 });
  return list.data.files?.length ?? 0;
}
