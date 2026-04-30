"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { reagirRecadoAction } from "@/lib/recados/actions";
import { REACAO_EMOJIS } from "@/lib/recados/schema";
import { cn } from "@/lib/utils";

export function EmojiReactionPicker({ recadoId }: { recadoId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function pick(emoji: string) {
    setOpen(false);
    startTransition(async () => {
      await reagirRecadoAction(recadoId, emoji);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={pending}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1 rounded-full border bg-card px-2 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground",
              pending && "opacity-50",
            )}
            aria-label="Adicionar reação"
          >
            <Plus className="h-3 w-3" />
          </button>
        }
      />
      <PopoverContent className="w-auto p-1" align="start">
        <div className="flex gap-1">
          {REACAO_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => pick(e)}
              className="rounded-md px-2 py-1 text-lg leading-none hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
