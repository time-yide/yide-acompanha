/**
 * Configuração do upload pro Google Drive a partir das envs.
 *
 * Dois jeitos de autenticar (o primeiro que estiver completo vence):
 *  1. OAuth de um usuário Google (GOOGLE_DRIVE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN):
 *     os arquivos ficam no "Meu Drive" desse usuário — serve pra pasta comum.
 *  2. Service account (GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON): a pasta raiz PRECISA
 *     estar num Drive compartilhado (unidade compartilhada), porque service
 *     account não tem cota de armazenamento própria e o Google recusa o upload
 *     ("storageQuotaExceeded") numa pasta do "Meu Drive" de alguém.
 *
 * Sem GOOGLE_DRIVE_ROOT_FOLDER_ID + uma das credenciais, o recurso fica
 * desligado e a tela de entrega continua pedindo o link colado.
 */

export interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

export type DriveAuthConfig =
  | { tipo: "oauth"; clientId: string; clientSecret: string; refreshToken: string }
  | { tipo: "service_account"; credentials: ServiceAccountCreds };

export interface DriveConfig {
  rootFolderId: string;
  auth: DriveAuthConfig;
}

type EnvLike = Record<string, string | undefined>;

/**
 * Lê o JSON da service account. Aceita o JSON cru ou em base64 (mais fácil de
 * colar no Vercel sem quebrar as quebras de linha da chave). Retorna null se
 * estiver vazio ou inválido.
 */
export function parseServiceAccountJson(raw: string | undefined): ServiceAccountCreds | null {
  const valor = raw?.trim();
  if (!valor) return null;
  const candidatos = [valor];
  if (!valor.startsWith("{")) {
    try {
      candidatos.push(Buffer.from(valor, "base64").toString("utf8"));
    } catch {
      // ignora — cai no null abaixo
    }
  }
  for (const c of candidatos) {
    try {
      const obj = JSON.parse(c) as Partial<ServiceAccountCreds>;
      if (typeof obj.client_email === "string" && typeof obj.private_key === "string" && obj.private_key.includes("PRIVATE KEY")) {
        return {
          client_email: obj.client_email,
          // Quando o JSON passa por env com "\\n" literal, desfaz o escape.
          private_key: obj.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      // tenta o próximo candidato
    }
  }
  return null;
}

export function resolveDriveConfig(env: EnvLike): DriveConfig | null {
  const rootFolderId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if (!rootFolderId) return null;

  const clientId = env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?.trim();
  if (clientId && clientSecret && refreshToken) {
    return { rootFolderId, auth: { tipo: "oauth", clientId, clientSecret, refreshToken } };
  }

  const credentials = parseServiceAccountJson(env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON);
  if (credentials) {
    return { rootFolderId, auth: { tipo: "service_account", credentials } };
  }
  return null;
}
