import { z } from "zod";
import type { Role } from "@/lib/auth/permissions";
import {
  CATEGORIA_VALUES,
  DRIVE_UPLOAD_MAX_ARQUIVOS,
  DRIVE_UPLOAD_MAX_BYTES,
  isArquivoVideo,
} from "./naming";

/** Quem pode subir vídeo pro Drive pelo sistema. */
export const DRIVE_UPLOAD_ROLES: readonly Role[] = [
  "videomaker", "fast_midia", "audiovisual_chefe", "editor",
  "coordenador", "assessor", "adm", "socio",
];

export function podeSubirProDrive(role: Role): boolean {
  return DRIVE_UPLOAD_ROLES.includes(role);
}

/** Papéis que veem o histórico de envios de todos (dentro da unidade, via RLS). */
export const ROLES_HISTORICO_GERAL: readonly Role[] = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];

export type EscopoHistoricoDrive =
  | { tipo: "nenhum" }
  | { tipo: "todos" }
  /** Só o que o usuário subiu + envios de clientes onde ele é o editor. */
  | { tipo: "proprios"; userId: string };

/**
 * Escopo do histórico de /audiovisual/upload-drive. ESPELHA a policy
 * "drive_uploads_select" da migration 20261116000100 — mudou um, muda o outro:
 *  - gestão (adm, socio, coordenador, assessor, audiovisual_chefe): uploads de
 *    clientes que enxerga (RLS de clients por unidade);
 *  - demais papéis com acesso: só linhas com uploaded_by = ele OU cliente cujo
 *    editor_id = ele.
 */
export function escopoHistoricoDrive(role: Role, userId: string): EscopoHistoricoDrive {
  if (!podeSubirProDrive(role)) return { tipo: "nenhum" };
  if (ROLES_HISTORICO_GERAL.includes(role)) return { tipo: "todos" };
  return { tipo: "proprios", userId };
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

export const prepareDriveUploadSchema = z.object({
  clientId: z.string({ error: "Selecione o cliente" }).uuid("Selecione o cliente"),
  categoria: z.enum(CATEGORIA_VALUES, { error: "Categoria inválida" }),
  /** Data de referência da pasta do mês (ex.: data da captação). */
  dataReferencia: dataIso,
  /** Página avulsa: avisa o editor do próprio cliente (vai assinado no token). */
  notificarEditor: z.boolean().default(false),
  files: z
    .array(
      z
        .object({
          name: z.string().min(1).max(500),
          size: z
            .number()
            .int()
            .positive("Arquivo vazio")
            .max(DRIVE_UPLOAD_MAX_BYTES, "Arquivo maior que 10 GB"),
          type: z.string().max(200),
        })
        .refine((f) => isArquivoVideo(f.name, f.type), {
          message: "Só arquivos de vídeo",
        }),
    )
    .min(1, "Selecione ao menos um vídeo")
    .max(DRIVE_UPLOAD_MAX_ARQUIVOS, `No máximo ${DRIVE_UPLOAD_MAX_ARQUIVOS} vídeos por envio`),
});

export type PrepareDriveUploadInput = z.input<typeof prepareDriveUploadSchema>;

export const confirmDriveUploadSchema = z.object({
  /** Token assinado devolvido pelo prepare — cliente, categoria e pasta vêm dele. */
  token: z.string().min(10).max(20_000),
  files: z
    .array(
      z.object({
        driveFileName: z.string().min(1).max(200),
        driveFileId: z.string().regex(/^[A-Za-z0-9_-]+$/, "ID de arquivo inválido").max(200),
      }),
    )
    .min(1)
    .max(DRIVE_UPLOAD_MAX_ARQUIVOS),
});

export type ConfirmDriveUploadInput = z.input<typeof confirmDriveUploadSchema>;
