// src/components/calendario/RoteiroToggle.tsx
"use client";

import { useState, useTransition, useRef } from "react";
import { FileText, FileUp, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { uploadRoteiroPdfAction } from "@/lib/briefing-gravacao/actions";

// Mirrors storage.ts constants (not imported directly — storage.ts is server-only).
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = "application/pdf";

function validatePdfFile(file: { size: number; type: string }): {
  ok: boolean;
  erro?: string;
} {
  if (file.type !== ALLOWED_MIME) {
    return { ok: false, erro: "Tipo invalido. Envie um PDF." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, erro: "Arquivo maior que 10MB." };
  }
  return { ok: true };
}

type Tipo = "link" | "pdf";

interface Props {
  eventoId: string | null; // null no create (upload acontece após criar)
  defaultTipo: Tipo | null;
  defaultLink: string | null;
  defaultPdfPath: string | null;
}

export function RoteiroToggle({
  eventoId,
  defaultTipo,
  defaultLink,
  defaultPdfPath,
}: Props) {
  const [tipo, setTipo] = useState<Tipo>(defaultTipo ?? "link");
  const [link, setLink] = useState(defaultLink ?? "");
  const [pdfPath, setPdfPath] = useState(defaultPdfPath ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setErro(null);
    const v = validatePdfFile({ size: file.size, type: file.type });
    if (!v.ok) {
      setErro(v.erro ?? "Arquivo invalido");
      return;
    }
    if (!eventoId) {
      setErro(
        "Salve o evento primeiro (sem roteiro) e edite depois pra anexar o PDF.",
      );
      return;
    }
    const fd = new FormData();
    fd.append("arquivo", file);
    startTransition(async () => {
      const r = await uploadRoteiroPdfAction(eventoId, fd);
      if ("error" in r) setErro(r.error);
      else setPdfPath(r.path);
    });
  }

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" /> Roteiro{" "}
        <span className="text-xs text-muted-foreground">(opcional)</span>
      </Label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipo("link")}
          className={`flex-1 rounded-md border px-3 py-1.5 text-sm ${
            tipo === "link"
              ? "border-primary bg-primary/10 text-primary"
              : "border-input text-muted-foreground hover:border-muted-foreground"
          }`}
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => setTipo("pdf")}
          className={`flex-1 rounded-md border px-3 py-1.5 text-sm ${
            tipo === "pdf"
              ? "border-primary bg-primary/10 text-primary"
              : "border-input text-muted-foreground hover:border-muted-foreground"
          }`}
        >
          PDF
        </button>
      </div>

      {tipo === "link" && (
        <>
          <Input
            id="link_roteiro"
            name="link_roteiro"
            type="url"
            placeholder="https://docs.google.com/..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <input type="hidden" name="roteiro_tipo" value={link ? "link" : ""} />
          <input type="hidden" name="roteiro_pdf_path" value="" />
        </>
      )}

      {tipo === "pdf" && (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_MIME}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {pdfPath ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="flex-1 truncate font-mono text-xs">
                {pdfPath.split("/").pop()}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPdfPath("")}
                title="Remover anexo"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={pending || !eventoId}
              className="w-full"
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              {pending
                ? "Enviando..."
                : `Selecionar PDF (max ${MAX_PDF_BYTES / 1024 / 1024}MB)`}
            </Button>
          )}
          <input type="hidden" name="link_roteiro" value="" />
          <input
            type="hidden"
            name="roteiro_tipo"
            value={pdfPath ? "pdf" : ""}
          />
          <input type="hidden" name="roteiro_pdf_path" value={pdfPath} />
        </div>
      )}

      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
