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
  atrasadas: number;
  proximas: number;
  emAndamento: number;
  concluidas: number;
  atrasadasList: TaskItem[];
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
        <tr
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Ver detalhes de ${props.nome}`}
          className="cursor-pointer hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
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
      <tr
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`Ver detalhes de ${props.nome}`}
        className="cursor-pointer hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <td className="px-3 py-2 font-medium underline-offset-4 hover:underline">{props.nome}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{props.funcao}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {props.atrasadas > 0 ? (
            <span className="inline-flex items-center justify-end gap-1 font-semibold text-rose-600 dark:text-rose-400">
              {props.atrasadas}
            </span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </td>
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
          atrasadasList={props.atrasadasList}
          proximasList={props.proximasList}
          emAndamentoList={props.emAndamentoList}
          concluidasList={props.concluidasList}
        />
      )}
    </>
  );
}
