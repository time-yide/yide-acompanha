"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Phone, MessageCircle, ArrowUpRight, ArrowDownLeft, Music, FileText, Save, Plus, X, PhoneCall,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { updateLigacaoAction, archiveLigacaoAction, definirResultadoLigacaoAction } from "@/lib/ligacoes/actions";
import { STATUS_DEFS, formatDuracao, formatNumeroBR, ORIGEM_LABELS } from "@/lib/ligacoes/tipos";
import type { StatusLigacao } from "@/lib/ligacoes/tipos";
import type { LigacaoRow } from "@/lib/ligacoes/queries";
import { formatDateTimeBR, formatTimeBR } from "@/lib/datetime/timezone";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ligacao: LigacaoRow;
  canManage: boolean;
}

// Resultados que a pessoa pode marcar pra uma ligação. Mapeiam pro enum interno.
const RESULTADOS: Array<{ value: StatusLigacao; label: string }> = [
  { value: "atendida", label: "Atendida" },
  { value: "perdida", label: "Não atendeu" },
  { value: "rejeitada", label: "Rejeitada" },
  { value: "ocupada", label: "Ocupado" },
  { value: "caixa_postal", label: "Caixa postal" },
  { value: "cancelada", label: "Cancelada" },
];

export function LigacaoDetalheModal({ open, onOpenChange, ligacao, canManage }: Props) {
  const router = useRouter();
  const [observacoes, setObservacoes] = useState(ligacao.observacoes ?? "");
  const [contatoNome, setContatoNome] = useState(ligacao.contato_nome ?? "");
  const [tags, setTags] = useState<string[]>(ligacao.tags);
  const [tagInput, setTagInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [pendingArchive, startArchive] = useTransition();
  const [savingStatus, startStatus] = useTransition();
  const [statusLocal, setStatusLocal] = useState(ligacao.status);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const statusDef = STATUS_DEFS[statusLocal as keyof typeof STATUS_DEFS];
  const isWA = ligacao.tipo === "whatsapp";
  const semResultado = statusLocal === "em_andamento";

  function definirResultado(novoStatus: StatusLigacao) {
    setError(null);
    const fd = new FormData();
    fd.set("id", ligacao.id);
    fd.set("status", novoStatus);
    startStatus(async () => {
      const r = await definirResultadoLigacaoAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setStatusLocal(novoStatus);
      // Atualiza a lista/contadores do painel sem fechar o modal.
      router.refresh();
    });
  }

  function addTag() {
    const v = tagInput.trim();
    if (!v || tags.includes(v) || tags.length >= 10) {
      setTagInput("");
      return;
    }
    setTags([...tags, v]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("id", ligacao.id);
    fd.set("observacoes", observacoes);
    fd.set("contato_nome", contatoNome);
    fd.set("tags", JSON.stringify(tags));
    startTransition(async () => {
      const r = await updateLigacaoAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSavedAt(new Date());
    });
  }

  function arquivar() {
    if (!confirm(`Arquivar esta ligação?`)) return;
    const fd = new FormData();
    fd.set("id", ligacao.id);
    startArchive(async () => {
      await archiveLigacaoAction(fd);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isWA ? (
              <MessageCircle className="h-5 w-5 text-emerald-500" />
            ) : (
              <Phone className="h-5 w-5 text-blue-500" />
            )}
            Detalhes da ligação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusDef?.color ?? ""}`}>
                {statusDef?.label ?? statusLocal}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {ligacao.direcao === "entrada" ? (
                  <><ArrowDownLeft className="h-2.5 w-2.5 mr-0.5" /> Entrada</>
                ) : (
                  <><ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> Saída</>
                )}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {isWA ? "WhatsApp" : "Telefone"}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {ORIGEM_LABELS[ligacao.origem as keyof typeof ORIGEM_LABELS] ?? ligacao.origem}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
              <DetalheLinha label="Número" value={formatNumeroBR(ligacao.numero)} mono />
              <DetalheLinha label="Duração" value={formatDuracao(ligacao.duracao_segundos)} mono />
              <DetalheLinha label="Iniciada em" value={formatDateTimeBR(ligacao.iniciada_em)} />
              {ligacao.finalizada_em && (
                <DetalheLinha label="Finalizada em" value={formatDateTimeBR(ligacao.finalizada_em)} />
              )}
              <DetalheLinha label="Colaborador" value={ligacao.colaborador_nome ?? ""} />
              {ligacao.client_nome && (
                <DetalheLinha label="Cliente" value={ligacao.client_nome} />
              )}
            </div>
          </div>

          {/* Resultado da ligação — marca/corrige o status (atendida, não atendeu, etc.) */}
          {canManage && (
            <div
              className={`rounded-lg border p-3 space-y-2 ${
                semResultado ? "border-amber-500/40 bg-amber-500/10" : "bg-card"
              }`}
            >
              <h3 className="text-sm font-semibold flex items-center gap-1">
                <PhoneCall className="h-4 w-4 text-blue-500" />
                {semResultado ? "Como foi essa ligação?" : "Resultado"}
              </h3>
              {semResultado && (
                <p className="text-xs text-muted-foreground">
                  Esta ligação está sem resultado (aparece em &quot;Outras&quot;). Marque como foi
                  pra ela contar certo no painel.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {RESULTADOS.map((r) => {
                  const ativo = statusLocal === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      disabled={savingStatus}
                      onClick={() => definirResultado(r.value)}
                      className={`inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50 ${
                        ativo ? "border-primary bg-primary/10 text-primary" : "bg-card"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gravação (se houver) */}
          {ligacao.gravacao_url ? (
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1">
                <Music className="h-4 w-4 text-violet-500" /> Gravação
              </h3>
              <audio controls className="w-full" src={ligacao.gravacao_url} />
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Music className="h-3 w-3" />
              Sem gravação disponível. Quando integrar com PABX/WhatsApp Business, as gravações aparecem aqui.
            </div>
          )}

          {/* Transcrição/Resumo IA (futuro) */}
          {(ligacao.transcricao || ligacao.resumo_ia) && (
            <div className="rounded-lg border bg-primary/5 border-primary/30 p-3 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1">
                <FileText className="h-4 w-4 text-primary" /> Análise IA
              </h3>
              {ligacao.resumo_ia && (
                <p className="text-xs whitespace-pre-wrap text-foreground/90">
                  <strong>Resumo:</strong> {ligacao.resumo_ia}
                </p>
              )}
              {ligacao.transcricao && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Ver transcrição completa
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-foreground/80">{ligacao.transcricao}</p>
                </details>
              )}
            </div>
          )}

          {/* Form editável */}
          {canManage && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Editar</h3>

              <div className="space-y-1.5">
                <Label htmlFor="contato_nome">Nome do contato</Label>
                <Input
                  id="contato_nome"
                  value={contatoNome}
                  onChange={(e) => setContatoNome(e.target.value)}
                  placeholder="Quem é essa pessoa?"
                  maxLength={200}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px]"
                    >
                      {t}
                      <button type="button" onClick={() => removeTag(t)}>
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addTag(); }
                    }}
                    placeholder="hot lead, follow-up..."
                    maxLength={40}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addTag}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  rows={4}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="O que aconteceu nessa ligação? Próximos passos..."
                  maxLength={2000}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center gap-2">
                <Button type="button" onClick={onSave} disabled={pending}>
                  <Save className="h-4 w-4" /> {pending ? "Salvando..." : "Salvar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/40 text-destructive"
                  onClick={arquivar}
                  disabled={pendingArchive}
                >
                  Arquivar
                </Button>
                {savedAt && !pending && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 ml-auto">
                    ✓ Salvo {formatTimeBR(savedAt)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalheLinha({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={mono ? "text-sm tabular-nums" : "text-sm"}>{value}</p>
    </div>
  );
}
