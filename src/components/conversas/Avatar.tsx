import { iniciais } from "@/lib/conversas/mock-data";

interface Props {
  nome: string;
  avatarUrl?: string | null;
  /** "sm" = 36px, "md" = 44px, "lg" = 56px */
  size?: "sm" | "md" | "lg";
  online?: boolean;
}

const SIZE_CLASSES = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
};

const DOT_POSITIONS = {
  sm: "h-2.5 w-2.5 right-0 bottom-0",
  md: "h-3 w-3 right-0 bottom-0",
  lg: "h-3.5 w-3.5 right-0.5 bottom-0.5",
};

/**
 * Avatar circular tipo WhatsApp - usa initials quando não tem foto.
 * Bolinha verde no canto inferior direito quando online=true.
 */
export function Avatar({ nome, avatarUrl, size = "md", online }: Props) {
  return (
    <div className="relative shrink-0">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={nome}
          className={`${SIZE_CLASSES[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${SIZE_CLASSES[size]} rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-600/30 dark:from-emerald-700/40 dark:to-teal-800/40 flex items-center justify-center font-semibold text-emerald-700 dark:text-emerald-200`}
        >
          {iniciais(nome) || "?"}
        </div>
      )}
      {online && (
        <span
          className={`${DOT_POSITIONS[size]} absolute rounded-full bg-emerald-500 ring-2 ring-card`}
          aria-label="Online"
        />
      )}
    </div>
  );
}
