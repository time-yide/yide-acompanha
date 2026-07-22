import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PessoaLink } from "./PessoaLink";
import {
  Clock, Drama, BookOpen, Briefcase, Gamepad2, Handshake, ClipboardList, Pencil,
} from "lucide-react";
import type { CardData } from "@/lib/perfil-jogador/schema";
import { ConquistasSecao } from "./ConquistasSecao";
import { SkillsSecao } from "./SkillsSecao";
import type { ConquistaCard } from "@/lib/conquistas/queries";
import type { SkillDerivada } from "@/lib/skills/derivar";

function initials(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function Secao({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-2 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">{icon}{titulo}</p>
      {children}
    </Card>
  );
}

export function CardJogador({ card, podeEditar, conquistas, skills }: { card: CardData; podeEditar: boolean; conquistas: ConquistaCard[]; skills: SkillDerivada[] }) {
  const { perfil } = card;
  return (
    <div className="space-y-4">
      {/* Capa + cabeçalho */}
      <Card className="overflow-hidden">
        <div className="relative h-32 w-full bg-muted sm:h-40">
          {perfil?.capa_url && (
            <Image src={perfil.capa_url} alt="capa" fill className="object-cover" unoptimized />
          )}
        </div>
        <div className="flex items-end justify-between gap-3 p-4">
          <div className="flex items-end gap-3">
            <div className="-mt-12">
              {card.avatarUrl ? (
                <Image src={card.avatarUrl} alt={card.nome} width={80} height={80} className="h-20 w-20 rounded-full border-4 border-background object-cover" unoptimized />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-muted text-2xl font-semibold text-muted-foreground">
                  {initials(card.nome)}
                </span>
              )}
            </div>
            <div className="pb-1">
              {perfil?.username && <p className="text-sm font-medium text-primary">@{perfil.username}</p>}
              <p className="text-lg font-bold leading-tight">{card.nome}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{card.cargoLabel}</span>
                {card.tempoDeCasa && (
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{card.tempoDeCasa}</span>
                )}
              </p>
              {perfil?.frase && <p className="mt-1 text-sm italic text-muted-foreground">“{perfil.frase}”</p>}
            </div>
          </div>
          {podeEditar && (
            <Link href={`/perfil/${card.userId}/editar`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="mr-2 h-4 w-4" />Editar
            </Link>
          )}
        </div>
      </Card>

      {/* Classe */}
      {card.classe && (
        <Secao icon={<Drama className="h-4 w-4" />} titulo="Classe">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">{card.classe}</Badge>
            <span className="text-xs text-muted-foreground">{card.classeDescricao}</span>
          </div>
        </Secao>
      )}

      {/* Sobre mim + Como trabalho */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Secao icon={<BookOpen className="h-4 w-4" />} titulo="Sobre mim">
          <p className="text-sm text-muted-foreground">{perfil?.bio || "Ainda não preencheu."}</p>
        </Secao>
        <Secao icon={<Briefcase className="h-4 w-4" />} titulo="Como gosto de trabalhar">
          <p className="text-sm text-muted-foreground">{perfil?.como_trabalho || "Ainda não preencheu."}</p>
        </Secao>
      </div>

      {/* Hobbies */}
      <Secao icon={<Gamepad2 className="h-4 w-4" />} titulo="Hobbies & interesses">
        {perfil?.hobbies && perfil.hobbies.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {perfil.hobbies.map((h) => <Badge key={h} variant="secondary">{h}</Badge>)}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Ainda não preencheu.</p>
        )}
      </Secao>

      {/* Sinergia */}
      {(card.sinergiaTrabalho.length > 0 || card.sinergiaHobbies.length > 0) && (
        <Secao icon={<Handshake className="h-4 w-4" />} titulo="Sinergia">
          {card.sinergiaTrabalho.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Combina no trabalho</p>
              <div className="flex flex-wrap gap-3">
                {card.sinergiaTrabalho.map((s) => (
                  <PessoaLink key={s.userId} id={s.userId} nome={s.nome} avatarUrl={s.avatarUrl} className="text-sm" />
                ))}
              </div>
            </div>
          )}
          {card.sinergiaHobbies.length > 0 && (
            <div className="space-y-1 pt-2">
              <p className="text-xs font-medium text-muted-foreground">Curte as mesmas coisas</p>
              <div className="flex flex-col gap-1">
                {card.sinergiaHobbies.map((s) => (
                  <span key={s.userId} className="flex items-center gap-2 text-sm">
                    <PessoaLink id={s.userId} nome={s.nome} avatarUrl={s.avatarUrl} />
                    <span className="text-xs text-muted-foreground">({s.motivo})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Secao>
      )}

      {/* Conquistas (Fase 2) */}
      <ConquistasSecao conquistas={conquistas} />

      {/* Skills (Fase 3) */}
      <SkillsSecao skills={skills} />

      {/* Resultados de pesquisas */}
      <Secao icon={<ClipboardList className="h-4 w-4" />} titulo="Resultados de pesquisas">
        {card.pesquisasRespondidas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma pesquisa respondida ainda.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {card.pesquisasRespondidas.map((p) => (
              <Link key={p.id} href={`/pesquisas/${p.id}`} className="text-sm hover:underline">{p.titulo}</Link>
            ))}
          </div>
        )}
      </Secao>
    </div>
  );
}
