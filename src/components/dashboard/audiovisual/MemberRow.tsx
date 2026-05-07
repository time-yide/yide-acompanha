"use client";

import { useState } from "react";
import { MemberDetailDialog } from "./MemberDetailDialog";
import type { GravacaoItem, TaskItem } from "@/lib/dashboard/audiovisual";

interface VideomakerProps {
  variant: "videomaker";
  nome: string;
  proximasGravacoes: number;
  concluidasNoPeriodo: number;
  proximasGravacoesList: GravacaoItem[];
}

interface EditorProps {
  variant: "edicao";
  nome: string;
  funcao: string;
  pendentes: number;
  concluidasNoPeriodo: number;
  pendentesList: TaskItem[];
}

type Props = VideomakerProps | EditorProps;

export function MemberRow(props: Props) {
  const [open, setOpen] = useState(false);

  const handleClick = () => setOpen(true);

  if (props.variant === "videomaker") {
    return (
      <>
        <tr onClick={handleClick} className="cursor-pointer hover:bg-muted/30">
          <td className="px-3 py-2 font-medium underline-offset-4 hover:underline">{props.nome}</td>
          <td className="px-3 py-2 text-right tabular-nums">{props.proximasGravacoes}</td>
          <td className="px-3 py-2 text-right tabular-nums">{props.concluidasNoPeriodo}</td>
        </tr>
        {open && (
          <MemberDetailDialog
            open={open}
            onOpenChange={setOpen}
            nome={props.nome}
            variant="videomaker"
            gravacoes={props.proximasGravacoesList}
          />
        )}
      </>
    );
  }

  return (
    <>
      <tr onClick={handleClick} className="cursor-pointer hover:bg-muted/30">
        <td className="px-3 py-2 font-medium underline-offset-4 hover:underline">{props.nome}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{props.funcao}</td>
        <td className="px-3 py-2 text-right tabular-nums">{props.pendentes}</td>
        <td className="px-3 py-2 text-right tabular-nums">{props.concluidasNoPeriodo}</td>
      </tr>
      {open && (
        <MemberDetailDialog
          open={open}
          onOpenChange={setOpen}
          nome={props.nome}
          variant="edicao"
          tarefas={props.pendentesList}
        />
      )}
    </>
  );
}
