"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CursoOnlineFormDialog } from "./CursoOnlineFormDialog";

export function CursoOnlineNewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        Novo curso
      </Button>
      <CursoOnlineFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
