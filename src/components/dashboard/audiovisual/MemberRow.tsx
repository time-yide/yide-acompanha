"use client";

import { useState } from "react";
import { MemberDetailDialog } from "./MemberDetailDialog";
import type { GravacaoItem, TaskItem, CapturaItem } from "@/lib/dashboard/audiovisual";

interface VideomakerProps {
  variant: "videomaker";
  nome: string;
  proximas: number;
  hoje: number;
  concluidas: number;
  proximasList: GravacaoItem[];
  hojeList: GravacaoItem[];
  concluidasList: CapturaItem[];
}

interface EditorProps {
  variant: "edicao";
  nome: string;
  funcao: string;
  proximas: number;
  emAndamento: number;
  concluidas: number;
  proximasList: TaskItem[];
  emAndamentoList: TaskItem[];
  concluidasList: TaskItem[];
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
          <td className="px-3 py-2 text-right tabular-nums">{props.proximas}</td>
          <td className="px-3 py-2 text-right tabular-nums">{props.hoje}</td>
          <td className="px-3 py-2 text-right tabular-nums">{props.concluidas}</td>
        </tr>
        {open && (
          <MemberDetailDialog
            open={open}
            onOpenChange={setOpen}
            nome={props.nome}
            variant="videomaker"
            proximasList={props.proximasList}
            hojeList={props.hojeList}
            concluidasList={props.concluidasList}
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
        <td className="px-3 py-2 text-right tabular-nums">{props.proximas}</td>
        <td className="px-3 py-2 text-right tabular-nums">{props.emAndamento}</td>
        <td className="px-3 py-2 text-right tabular-nums">{props.concluidas}</td>
      </tr>
      {open && (
        <MemberDetailDialog
          open={open}
          onOpenChange={setOpen}
          nome={props.nome}
          variant="edicao"
          proximasList={props.proximasList}
          emAndamentoList={props.emAndamentoList}
          concluidasList={props.concluidasList}
        />
      )}
    </>
  );
}
