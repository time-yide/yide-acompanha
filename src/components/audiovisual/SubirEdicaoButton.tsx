"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { subirEdicaoManualAction } from "@/lib/audiovisual/actions";

interface Editor {
  id: string;
  nome: string;
  role?: string;
}

interface Cliente {
  id: string;
  nome: string;
}

interface Props {
  clientes: Cliente[];
  editores: Editor[];
}

export function SubirEdicaoButton({ clientes, editores }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [editorId, setEditorId] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [dataCaptacao, setDataCaptacao] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [qtdVideos, setQtdVideos] = useState("0");
  const [qtdFotos, setQtdFotos] = useState("0");
  const [observacoes, setObservacoes] = useState("");

  const [clientSearch, setClientSearch] = useState("");
  const filteredClientes = clientSearch.trim()
    ? clientes.filter((c) =>
        c.nome.toLowerCase().includes(clientSearch.toLowerCase()),
      )
    : clientes;
  const selectedClient = clientes.find((c) => c.id === clientId);

  function resetForm() {
    setClientId("");
    setEditorId("");
    setDriveUrl("");
    setDataCaptacao(new Date().toISOString().slice(0, 10));
    setQtdVideos("0");
    setQtdFotos("0");
    setObservacoes("");
    setClientSearch("");
    setError(null);
  }

  function handleConfirm() {
    setError(null);
    if (!clientId) { setError("Selecione o cliente"); return; }
    if (!editorId) { setError("Selecione o editor"); return; }

    startTransition(async () => {
      const r = await subirEdicaoManualAction({
        client_id: clientId,
        editor_id: editorId,
        drive_url: driveUrl.trim() || undefined,
        data_captacao: dataCaptacao,
        qtd_videos: Number(qtdVideos) || 0,
        qtd_fotos: Number(qtdFotos) || 0,
        observacoes: observacoes.trim() || null,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      toast.success("Edição subida com sucesso");
      resetForm();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { resetForm(); setOpen(true); }}
        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Upload className="h-4 w-4" />
        Subir edição
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir edição manual</DialogTitle>
            <DialogDescription>
              Crie uma captação já delegada a um editor. Use quando uma edição se
              perdeu ou precisa ser registrada manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cliente */}
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              {selectedClient ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{selectedClient.nome}</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() => { setClientId(""); setClientSearch(""); }}
                  >
                    trocar
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar cliente…"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  {clientSearch.trim() && (
                    <div className="max-h-32 overflow-y-auto rounded border bg-popover text-sm">
                      {filteredClientes.length === 0 && (
                        <p className="px-3 py-2 text-muted-foreground">Nenhum resultado</p>
                      )}
                      {filteredClientes.slice(0, 20).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="block w-full px-3 py-1.5 text-left hover:bg-accent"
                          onClick={() => { setClientId(c.id); setClientSearch(""); }}
                        >
                          {c.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Editor */}
            <div className="space-y-1.5">
              <Label>Editor *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={editorId}
                onChange={(e) => setEditorId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {editores.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>

            {/* Link do Drive */}
            <div className="space-y-1.5">
              <Label>Link do Drive</Label>
              <Input
                placeholder="https://drive.google.com/..."
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <Label>Data da captação *</Label>
              <Input
                type="date"
                value={dataCaptacao}
                onChange={(e) => setDataCaptacao(e.target.value)}
              />
            </div>

            {/* Quantidades */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vídeos</Label>
                <Input
                  type="number"
                  min="0"
                  value={qtdVideos}
                  onChange={(e) => setQtdVideos(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fotos</Label>
                <Input
                  type="number"
                  min="0"
                  value={qtdFotos}
                  onChange={(e) => setQtdFotos(e.target.value)}
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                placeholder="O que aconteceu, por que precisa subir manual…"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subindo…
                </>
              ) : (
                "Subir edição"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
