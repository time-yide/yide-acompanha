import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  CATEGORIAS_VIDEO,
  escapeDriveQuery,
  escolherLinkEntrega,
  extensaoArquivo,
  hrefPastaDrive,
  isArquivoVideo,
  mimeVideo,
  nomeArquivoDrive,
  nomePastaCategoria,
  nomePastaCliente,
  nomePastaMes,
  proximaSequencia,
  DRIVE_UPLOAD_MAX_BYTES,
} from "@/lib/google-drive/naming";
import { parseServiceAccountJson, resolveDriveConfig } from "@/lib/google-drive/config";
import {
  DRIVE_UPLOAD_ROLES,
  ROLES_HISTORICO_GERAL,
  confirmDriveUploadSchema,
  escopoHistoricoDrive,
  podeSubirProDrive,
  prepareDriveUploadSchema,
} from "@/lib/google-drive/schema";
import {
  assinarSessaoUpload,
  derivarChaveToken,
  verificarSessaoUpload,
  type DriveUploadSessao,
} from "@/lib/google-drive/token";

const UUID = "11111111-1111-4111-8111-111111111111";
const FAKE_KEY = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n";

describe("nomePastaMes", () => {
  it("formata mês por extenso + ano", () => {
    expect(nomePastaMes("2026-09-15")).toBe("Setembro 2026");
    expect(nomePastaMes("2027-01-01")).toBe("Janeiro 2027");
    expect(nomePastaMes("2026-03-31")).toBe("Março 2026");
    expect(nomePastaMes("2026-12-31")).toBe("Dezembro 2026");
  });

  it("não escorrega de mês por fuso no dia 1º", () => {
    expect(nomePastaMes("2026-10-01")).toBe("Outubro 2026");
  });

  it("rejeita data inválida", () => {
    expect(() => nomePastaMes("2026-13-01")).toThrow();
    expect(() => nomePastaMes("15/09/2026")).toThrow();
  });
});

describe("categorias", () => {
  it("mapeia valor pra nome de pasta", () => {
    expect(nomePastaCategoria("reels")).toBe("Reels");
    expect(nomePastaCategoria("bruto")).toBe("Brutos");
    expect(nomePastaCategoria("outro")).toBe("Outros");
  });

  it("valores e pastas são únicos", () => {
    expect(new Set(CATEGORIAS_VIDEO.map((c) => c.value)).size).toBe(CATEGORIAS_VIDEO.length);
    expect(new Set(CATEGORIAS_VIDEO.map((c) => c.pasta)).size).toBe(CATEGORIAS_VIDEO.length);
  });

  it("categoria desconhecida lança", () => {
    // @ts-expect-error — valor fora do enum
    expect(() => nomePastaCategoria("tiktok")).toThrow();
  });
});

describe("nomePastaCliente", () => {
  it("normaliza espaços e barras", () => {
    expect(nomePastaCliente("  Empresa   X ")).toBe("Empresa X");
    expect(nomePastaCliente("A/B Comércio")).toBe("A-B Comércio");
    expect(nomePastaCliente("   ")).toBe("Sem nome");
  });
});

describe("escapeDriveQuery", () => {
  it("escapa aspas simples e barra invertida", () => {
    expect(escapeDriveQuery("D'Ávila")).toBe("D\\'Ávila");
    expect(escapeDriveQuery("a\\b")).toBe("a\\\\b");
  });
});

describe("arquivos", () => {
  it("nome sequencial com 2 dígitos e extensão em minúsculas", () => {
    expect(nomeArquivoDrive(1, "IMG_0001.MOV")).toBe("video-01.mov");
    expect(nomeArquivoDrive(12, "clip.mp4")).toBe("video-12.mp4");
    expect(nomeArquivoDrive(105, "x.mkv")).toBe("video-105.mkv");
    expect(nomeArquivoDrive(3, "sem-extensao")).toBe("video-03.mp4");
    expect(() => nomeArquivoDrive(0, "a.mp4")).toThrow();
  });

  it("próxima sequência usa o maior número, não a contagem", () => {
    expect(proximaSequencia([])).toBe(1);
    expect(proximaSequencia(["video-01.mp4", "video-02.mov"])).toBe(3);
    expect(proximaSequencia(["video-01.mp4", "video-07.mp4", "foto.jpg"])).toBe(8);
    expect(proximaSequencia(["renomeado.mp4"])).toBe(1);
  });

  it("extensão canônica da allowlist", () => {
    expect(extensaoArquivo("a.b.MP4")).toBe("mp4");
    expect(extensaoArquivo("arquivo")).toBe("mp4");
    expect(extensaoArquivo("evil.html")).toBe("mp4");
    expect(extensaoArquivo("x.exe")).toBe("mp4");
  });

  it("nome no Drive nunca carrega extensão fora da allowlist", () => {
    expect(nomeArquivoDrive(1, "payload.html")).toBe("video-01.mp4");
    expect(nomeArquivoDrive(2, "clip.MKV")).toBe("video-02.mkv");
  });

  it("exige extensão de vídeo mesmo com MIME video/*", () => {
    expect(isArquivoVideo("a.mp4", "video/mp4")).toBe(true);
    expect(isArquivoVideo("a.MTS", "")).toBe(true);
    expect(isArquivoVideo("a.mov", "application/octet-stream")).toBe(true);
    expect(isArquivoVideo("evil.html", "video/mp4")).toBe(false);
    expect(isArquivoVideo("semextensao", "video/mp4")).toBe(false);
    expect(isArquivoVideo("a.mp4", "text/html")).toBe(false);
    expect(isArquivoVideo("a.jpg", "image/jpeg")).toBe(false);
    expect(isArquivoVideo("a.pdf", "")).toBe(false);
  });

  it("MIME enviado ao Drive sempre vem da allowlist", () => {
    expect(mimeVideo("a.mov")).toBe("video/quicktime");
    expect(mimeVideo("a.webm")).toBe("video/webm");
    expect(mimeVideo("a.xyz")).toBe("video/mp4");
  });
});

describe("escolherLinkEntrega", () => {
  const reels = { folderUrl: "https://drive.google.com/drive/folders/reels", mesFolderUrl: "https://drive.google.com/drive/folders/mes" };
  const stories = { folderUrl: "https://drive.google.com/drive/folders/stories", mesFolderUrl: "https://drive.google.com/drive/folders/mes" };

  it("uma categoria → pasta da categoria", () => {
    expect(escolherLinkEntrega([reels, reels])).toBe(reels.folderUrl);
  });

  it("mais de uma categoria → pasta do mês", () => {
    expect(escolherLinkEntrega([reels, stories])).toBe(reels.mesFolderUrl);
  });

  it("nenhum envio → null", () => {
    expect(escolherLinkEntrega([])).toBeNull();
  });
});

describe("hrefPastaDrive", () => {
  it("só libera URL de pasta do Drive pra usar em href", () => {
    expect(hrefPastaDrive("https://drive.google.com/drive/folders/abc_DEF-1")).toBe("https://drive.google.com/drive/folders/abc_DEF-1");
    expect(hrefPastaDrive("javascript:alert(1)")).toBeNull();
    expect(hrefPastaDrive("https://drive.google.com.evil.com/drive/folders/x")).toBeNull();
    expect(hrefPastaDrive("https://drive.google.com/drive/folders/x?y=1")).toBeNull();
    expect(hrefPastaDrive(null)).toBeNull();
  });
});

describe("prepareDriveUploadSchema", () => {
  const base = {
    clientId: UUID,
    categoria: "reels",
    dataReferencia: "2026-09-15",
    files: [{ name: "a.mp4", size: 1000, type: "video/mp4" }],
  };

  it("aceita entrada válida (notificarEditor default false)", () => {
    const r = prepareDriveUploadSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data?.notificarEditor).toBe(false);
  });

  it("exige cliente", () => {
    const r = prepareDriveUploadSchema.safeParse({ ...base, clientId: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Selecione o cliente");
  });

  it("recusa categoria fora da lista, arquivo não-vídeo, vazio ou grande demais", () => {
    expect(prepareDriveUploadSchema.safeParse({ ...base, categoria: "tiktok" }).success).toBe(false);
    expect(prepareDriveUploadSchema.safeParse({ ...base, files: [{ name: "a.jpg", size: 10, type: "image/jpeg" }] }).success).toBe(false);
    expect(prepareDriveUploadSchema.safeParse({ ...base, files: [{ name: "a.mp4", size: 0, type: "video/mp4" }] }).success).toBe(false);
    expect(prepareDriveUploadSchema.safeParse({ ...base, files: [{ name: "a.mp4", size: DRIVE_UPLOAD_MAX_BYTES + 1, type: "video/mp4" }] }).success).toBe(false);
    expect(prepareDriveUploadSchema.safeParse({ ...base, files: [] }).success).toBe(false);
    expect(prepareDriveUploadSchema.safeParse({ ...base, files: [{ name: "x.html", size: 10, type: "video/mp4" }] }).success).toBe(false);
  });
});

describe("confirmDriveUploadSchema", () => {
  it("só aceita token + nomes/IDs (cliente, pasta e categoria vêm do token)", () => {
    const base = { token: "payload.assinatura", files: [{ driveFileName: "video-01.mp4", driveFileId: "abc_DEF-123" }] };
    const ok = confirmDriveUploadSchema.safeParse(base);
    expect(ok.success).toBe(true);
    expect(ok.data && "clientId" in ok.data).toBe(false);
    expect(confirmDriveUploadSchema.safeParse({ ...base, files: [{ driveFileName: "v.mp4", driveFileId: "../x" }] }).success).toBe(false);
    expect(confirmDriveUploadSchema.safeParse({ files: base.files }).success).toBe(false);
  });
});

describe("token da sessão de upload", () => {
  const chave = derivarChaveToken("segredo-de-teste-com-tamanho-suficiente");
  const sessao: DriveUploadSessao = {
    v: 1,
    uid: "user-1",
    clientId: UUID,
    categoria: "reels",
    folderId: "folder_ABC-1",
    notificarEditor: true,
    arquivos: [{ driveFileName: "video-01.mp4", originalName: "IMG_1.MOV" }],
    exp: 2_000_000_000_000,
  };

  it("assina e valida ida e volta", () => {
    const token = assinarSessaoUpload(sessao, chave);
    const r = verificarSessaoUpload(token, chave, { uid: "user-1", agora: 1_000 });
    expect(r).toEqual({ ok: true, sessao });
  });

  it("recusa payload adulterado", () => {
    const token = assinarSessaoUpload(sessao, chave);
    const [, sig] = token.split(".");
    const falso = Buffer.from(JSON.stringify({ ...sessao, clientId: "22222222-2222-4222-8222-222222222222" })).toString("base64url");
    expect(verificarSessaoUpload(`${falso}.${sig}`, chave, { uid: "user-1", agora: 1_000 })).toEqual({ ok: false, motivo: "assinatura" });
  });

  it("recusa chave diferente, outro usuário, expirado e lixo", () => {
    const token = assinarSessaoUpload(sessao, chave);
    expect(verificarSessaoUpload(token, derivarChaveToken("outra-chave-qualquer-bem-comprida-aqui"), { uid: "user-1", agora: 1_000 }).ok).toBe(false);
    expect(verificarSessaoUpload(token, chave, { uid: "user-2", agora: 1_000 })).toEqual({ ok: false, motivo: "usuario" });
    expect(verificarSessaoUpload(token, chave, { uid: "user-1", agora: sessao.exp + 1 })).toEqual({ ok: false, motivo: "expirado" });
    expect(verificarSessaoUpload("nada", chave, { uid: "user-1" })).toEqual({ ok: false, motivo: "formato" });
  });

  it("recusa payload assinado mas com formato inválido", () => {
    const token = assinarSessaoUpload({ ...sessao, folderId: "../x" }, chave);
    expect(verificarSessaoUpload(token, chave, { uid: "user-1", agora: 1_000 })).toEqual({ ok: false, motivo: "formato" });
  });
});

describe("permissões e escopo do histórico", () => {
  it("papéis que podem subir", () => {
    expect(podeSubirProDrive("videomaker")).toBe(true);
    expect(podeSubirProDrive("editor")).toBe(true);
    expect(podeSubirProDrive("comercial")).toBe(false);
  });

  it("gestão vê tudo (dentro da RLS), operacional só o próprio", () => {
    expect(escopoHistoricoDrive("adm", "u1")).toEqual({ tipo: "todos" });
    expect(escopoHistoricoDrive("audiovisual_chefe", "u1")).toEqual({ tipo: "todos" });
    expect(escopoHistoricoDrive("videomaker", "u1")).toEqual({ tipo: "proprios", userId: "u1" });
    expect(escopoHistoricoDrive("fast_midia", "u1")).toEqual({ tipo: "proprios", userId: "u1" });
    expect(escopoHistoricoDrive("editor", "u2")).toEqual({ tipo: "proprios", userId: "u2" });
    expect(escopoHistoricoDrive("comercial", "u3")).toEqual({ tipo: "nenhum" });
  });
});

describe("policy de RLS espelha escopoHistoricoDrive", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261116000100_drive_uploads.sql"), "utf8");
  const listas = [...sql.matchAll(/in \(([^)]*)\)/g)].map((m) =>
    m[1].split(",").map((x) => x.trim().replace(/'/g, "")).sort(),
  );

  it("gestão na policy = ROLES_HISTORICO_GERAL", () => {
    expect(listas).toContainEqual([...ROLES_HISTORICO_GERAL].sort());
  });

  it("papéis restritos na policy = demais papéis que podem subir", () => {
    const restritos = DRIVE_UPLOAD_ROLES.filter((r) => !ROLES_HISTORICO_GERAL.includes(r)).sort();
    expect(listas).toContainEqual(restritos);
  });

  it("papéis restritos filtrados por uploaded_by ou editor_id, sem policy de insert", () => {
    expect(sql).toMatch(/drive_uploads\.uploaded_by = auth\.uid\(\)/);
    expect(sql).toMatch(/c2\.editor_id = auth\.uid\(\)/);
    expect(sql).not.toMatch(/for insert/i);
  });
});

describe("config do Drive", () => {
  const sa = JSON.stringify({ client_email: "bot@proj.iam.gserviceaccount.com", private_key: FAKE_KEY });

  it("desligado sem pasta raiz ou sem credencial", () => {
    expect(resolveDriveConfig({})).toBeNull();
    expect(resolveDriveConfig({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: sa })).toBeNull();
    expect(resolveDriveConfig({ GOOGLE_DRIVE_ROOT_FOLDER_ID: "root" })).toBeNull();
    expect(resolveDriveConfig({ GOOGLE_DRIVE_ROOT_FOLDER_ID: "root", GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: "{lixo" })).toBeNull();
  });

  it("service account em JSON cru ou base64", () => {
    const cru = resolveDriveConfig({ GOOGLE_DRIVE_ROOT_FOLDER_ID: "root", GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: sa });
    expect(cru?.auth.tipo).toBe("service_account");
    const b64 = parseServiceAccountJson(Buffer.from(sa).toString("base64"));
    expect(b64?.client_email).toBe("bot@proj.iam.gserviceaccount.com");
  });

  it("desfaz \\n literal da chave", () => {
    const escapado = `{"client_email":"a@b.com","private_key":"-----BEGIN PRIVATE KEY-----\\\\nabc\\\\n-----END PRIVATE KEY-----"}`;
    expect(parseServiceAccountJson(escapado)?.private_key).toContain("\nabc\n");
  });

  it("OAuth completo tem prioridade sobre service account", () => {
    const cfg = resolveDriveConfig({
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "root",
      GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: sa,
      GOOGLE_DRIVE_OAUTH_CLIENT_ID: "id",
      GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: "secret",
      GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "refresh",
    });
    expect(cfg?.auth.tipo).toBe("oauth");
  });

  it("OAuth incompleto cai pra service account", () => {
    const cfg = resolveDriveConfig({
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "root",
      GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: sa,
      GOOGLE_DRIVE_OAUTH_CLIENT_ID: "id",
    });
    expect(cfg?.auth.tipo).toBe("service_account");
  });
});
