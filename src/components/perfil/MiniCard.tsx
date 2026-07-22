import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Classe } from "@/lib/perfil-jogador/schema";

function initials(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function MiniCard({
  userId, nome, cargoLabel, avatarUrl, username, classe,
}: {
  userId: string; nome: string; cargoLabel: string; avatarUrl: string | null; username: string | null; classe: Classe | null;
}) {
  return (
    <Link href={`/perfil/${userId}`}>
      <Card className="flex flex-col items-center gap-2 p-4 text-center transition hover:border-primary/50 hover:bg-muted/30">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={nome} width={56} height={56} className="h-14 w-14 rounded-full object-cover" unoptimized />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">{initials(nome)}</span>
        )}
        <div>
          <p className="text-sm font-medium leading-tight">{nome}</p>
          {username && <p className="text-xs text-primary">@{username}</p>}
          <p className="text-xs text-muted-foreground">{cargoLabel}</p>
        </div>
        {classe && <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">{classe}</Badge>}
      </Card>
    </Link>
  );
}
