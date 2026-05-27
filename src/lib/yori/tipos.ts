export const BASE_TEMPLATES = ["submagic", "tiktok", "reels_box"] as const;
export type BaseTemplate = (typeof BASE_TEMPLATES)[number];

export const FONT_FAMILIES = [
  "inter",
  "montserrat",
  "bebas",
  "oswald",
  "poppins",
  "roboto",
  "anton",
  "archivo_black",
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const POSITIONS = ["top", "center", "bottom"] as const;
export type Position = (typeof POSITIONS)[number];

export const ANIMATIONS = ["pop", "fade", "slide", "none"] as const;
export type Animation = (typeof ANIMATIONS)[number];

export const JOB_STATUSES = [
  "pending",
  "transcribing",
  "rendering",
  "done",
  "error",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const SYSTEM_TEMPLATE_IDS = {
  submagic: "00000000-0000-0000-0000-000000000001",
  tiktok: "00000000-0000-0000-0000-000000000002",
  reels_box: "00000000-0000-0000-0000-000000000003",
} as const;

export interface YoriTemplate {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  nome: string;
  is_system: boolean;
  base_template: BaseTemplate;
  primary_color: string;
  highlight_color: string | null;
  font_family: FontFamily;
  font_size: number;
  position: Position;
  position_y_offset: number;
  has_shadow: boolean;
  shadow_intensity: number;
  animation: Animation;
  created_at: string;
}

export interface YoriJob {
  id: string;
  organization_id: string;
  unit_id: string | null;
  user_id: string;
  template_id: string;
  video_filename: string;
  video_path: string | null;
  video_duration_seconds: number | null;
  video_size_bytes: number | null;
  status: JobStatus;
  progress_pct: number;
  error_message: string | null;
  srt_path: string | null;
  txt_path: string | null;
  mp4_path: string | null;
  transcription: WhisperTranscription | null;
  downloaded_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  whisper_cost_brl: number | null;
  lambda_cost_brl: number | null;
}

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WhisperTranscription {
  text: string;
  language: string;
  duration: number;
  words: WhisperWord[];
}
