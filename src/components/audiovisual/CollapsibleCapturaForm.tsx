"use client";

import { useState } from "react";
import { ChevronDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CapturaForm } from "./CapturaForm";
import type { PendenteEvento } from "@/lib/audiovisual/queries";

interface Props {
  clientes: Array<{ id: string; nome: string }>;
  pendentes: PendenteEvento[];
}

export function CollapsibleCapturaForm({ clientes, pendentes }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" className="w-full gap-2" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Entregar captação
        <ChevronDown className="h-4 w-4" />
      </Button>
    );
  }

  return <CapturaForm clientes={clientes} pendentes={pendentes} />;
}
