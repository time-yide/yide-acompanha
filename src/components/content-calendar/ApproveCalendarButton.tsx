"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { approveCalendarAction } from "@/lib/content-calendar/actions";

interface Props {
  calendarId: string;
}

export function ApproveCalendarButton({ calendarId }: Props) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleApprove() {
    setLoading(true);
    try {
      const result = await approveCalendarAction(calendarId);
      if ("error" in result) {
        alert(result.error);
      }
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button size="sm">
            <Check className="h-4 w-4" />
            Aprovar cronograma
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aprovar cronograma?</AlertDialogTitle>
          <AlertDialogDescription>
            Ao aprovar, os posts serao criados como rascunho no Social Media e
            uma tarefa sera criada. Continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleApprove} disabled={loading}>
            {loading ? "Aprovando..." : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
