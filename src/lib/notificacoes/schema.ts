import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "task_assigned",
  "task_completed",
  "design_aprovado",
  "design_ajustes_solicitados",
  "social_post_aprovado",
  "social_post_ajustes_solicitados",
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const markReadSchema = z.object({
  id: z.string().uuid(),
});

export interface Notification {
  id: string;
  user_id: string;
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}
