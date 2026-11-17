import { z } from "zod";
import type { Role } from "@/lib/auth/permissions";
import {
  CATEGORIA_VALUES,
  DRIVE_FOLDER_URL_RE,
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
const ROLES_HISTORICO_GERAL: readonly Role[] = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];

export type EscopoHistoricoDrive =
  | { tipo: "nenhum" }
  | { tipo: "todos" }
  /** Só o que o usuário subiu + (editor) envios de clientes onde ele é o editor. */
  | { tipo: "proprios"; userId: string; incluiClientesDoEditor: boolean };

/**
 * Escopo do histórico de /audiovisual/upload-drive. A RLS já limita à unidade
 * (clientes visíveis); isto restringe os papéis operacionais aos próprios envios.
 */
export function escopoHistoricoDrive(role: Role, userId: string): EscopoHistoricoDrive {
  if (!podeSubirProDrive(role)) return { tipo: "nenhum" };
  if (ROLES_HISTORICO_GERAL.includes(role)) return { tipo: "todos" };
  return { tipo: "proprios", userId, incluiClientesDoEditor: role === "editor" };
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

export const prepareDriveUploadSchema = z.object({
  clientId: z.string({ error: "Selecione o cliente" }).uuid("Selecione o cliente"),
  categoria: z.enum(CATEGORIA_VALUES, { error: "Categoria inválida" }),
  /** Data de referência da pasta do mês (ex.: data da captação). */
  dataReferencia: dataIso,
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
  clientId: z.string().uuid(),
  categoria: z.enum(CATEGORIA_VALUES),
  folderUrl: z.string().regex(DRIVE_FOLDER_URL_RE, "URL de pasta do Drive inválida"),
  /** true na página avulsa: avisa o editor do cliente que tem vídeo novo. */
  notificarEditor: z.boolean().default(false),
  files: z
    .array(
      z.object({
        originalName: z.string().min(1).max(500),
        driveFileName: z.string().min(1).max(200),
        driveFileId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(200).nullable().optional(),
        sizeBytes: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(DRIVE_UPLOAD_MAX_ARQUIVOS),
});

export type ConfirmDriveUploadInput = z.input<typeof confirmDriveUploadSchema>;
