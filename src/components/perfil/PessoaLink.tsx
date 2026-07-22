import Link from "next/link";
import Image from "next/image";

function initials(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function PessoaLink({
  id,
  nome,
  avatarUrl = null,
  showAvatar = true,
  className = "",
}: {
  id: string;
  nome: string;
  avatarUrl?: string | null;
  showAvatar?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/perfil/${id}`}
      className={`inline-flex items-center gap-2 hover:underline ${className}`}
    >
      {showAvatar &&
        (avatarUrl ? (
          <Image src={avatarUrl} alt={nome} width={24} height={24} className="h-6 w-6 rounded-full object-cover" unoptimized />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
            {initials(nome)}
          </span>
        ))}
      <span className="truncate">{nome}</span>
    </Link>
  );
}
