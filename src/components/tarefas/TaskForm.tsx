"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, X, Link as LinkIcon, Upload, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  uploadTaskAttachmentAction,
  removeTaskAttachmentAction,
  fetchClienteEquipeAction,
} from "@/lib/tarefas/upload-actions";
import type { TaskLink } from "@/lib/tarefas/queries";

interface ProfileOption { id: string; nome: string; role?: string | null; }
interface ClientOption { id: string; nome: string; }

/**
 * Mapeia role do responsável → tipo de tarefa pro painel mensal conseguir
 * derivar a step "edicao" automaticamente.
 * - designer            → "arte"
 * - videomaker / videomaker_mobile / editor / audiovisual_chefe → "video"
 * - demais              → null (mantém o que tava)
 */
function tipoFromRole(role: string | null | undefined): "arte" | "video" | null {
  if (role === "designer") return "arte";
  if (role === "videomaker" || role === "videomaker_mobile" || role === "editor" || role === "audiovisual_chefe") {
    return "video";
  }
  return null;
}

type ActionResult = { error?: string } | undefined;

interface Props {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  profiles: ProfileOption[];
  clientes: ClientOption[];
  defaults?: Partial<{
    id: string;
    titulo: string;
    descricao: string | null;
    prioridade: string;
    status: string;
    tipo: string;
    formatos: string[];
    atribuido_a: string;
    client_id: string | null;
    due_date: string | null;
    participantes_ids: string[];
    links: TaskLink[];
    attachment_urls: string[];
  }>;
  isEdit?: boolean;
  submitLabel?: string;
  /** Quando passado, usado como id pré-gerado pra path de upload. */
  preGeneratedId?: string;
  /** Quando passado, exibe um link "Cancelar" ao lado do submit. */
  cancelHref?: string;
}

const PROFILE_NONE = "_none";

function nomeOf(profiles: ProfileOption[], id: string | null | undefined): string {
  if (!id) return "";
  return profiles.find((p) => p.id === id)?.nome ?? id.slice(0, 8);
}

export function TaskForm({
  action, profiles, clientes, defaults = {}, isEdit = false, submitLabel = "Salvar", preGeneratedId, cancelHref,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  // Pré-gera UUID estável pro form (path de upload de anexo precisa do id antes do insert)
  const [taskId] = useState<string>(() => preGeneratedId ?? defaults.id ?? crypto.randomUUID());

  const [clientId, setClientId] = useState<string>(defaults.client_id ?? PROFILE_NONE);
  const [atribuidoA, setAtribuidoA] = useState<string>(defaults.atribuido_a ?? "");
  const [participantes, setParticipantes] = useState<string[]>(defaults.participantes_ids ?? []);
  const [links, setLinks] = useState<TaskLink[]>(defaults.links ?? []);
  const [attachments, setAttachments] = useState<string[]>(defaults.attachment_urls ?? []);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [tipo, setTipo] = useState<string>(defaults.tipo ?? "geral");
  const [formatos, setFormatos] = useState<string[]>(defaults.formatos ?? []);
  // Marca se o usuário trocou o tipo manualmente — quando true, não auto-deriva
  // mais ao trocar de responsável (evita sobrescrever escolha consciente).
  const [tipoManuallySet, setTipoManuallySet] = useState<boolean>(
    isEdit && !!defaults.tipo && defaults.tipo !== "geral",
  );
  const requiresFormato = tipo === "video" || tipo === "arte";
  const atribuidoRole = profiles.find((p) => p.id === atribuidoA)?.role ?? null;
  const autoTipo = tipoFromRole(atribuidoRole);
  const tipoAutoDetected = !tipoManuallySet && autoTipo !== null && tipo === autoTipo;

  /**
   * Auto-deriva o tipo a partir do role do responsável escolhido.
   * Só atua se o usuário ainda não trocou o tipo manualmente — pra não atropelar
   * uma escolha consciente. Quando responsável volta pra alguém não-produtor, NÃO
   * reseta pra "geral" (pode ser intencional).
   */
  function onAtribuidoChange(newId: string) {
    setAtribuidoA(newId);
    if (tipoManuallySet) return;
    const role = profiles.find((p) => p.id === newId)?.role ?? null;
    const auto = tipoFromRole(role);
    if (auto && tipo !== auto) {
      setTipo(auto);
      // Default razoável: feed (usuário pode adicionar story depois).
      if (formatos.length === 0) setFormatos(["feed"]);
      addCoordenadoresAvIfVideo(auto);
    }
  }

  function onTipoChange(v: string) {
    setTipo(v);
    setTipoManuallySet(true);
    addCoordenadoresAvIfVideo(v);
  }

  function toggleFormato(value: string) {
    setFormatos((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value],
    );
  }

  // Ao trocar cliente: puxa equipe e auto-adiciona coordenador + assessor como
  // atribuídos adicionais. NÃO preenche o "Responsável pela execução" (executor
  // é definido manualmente pelo criador da tarefa).
  useEffect(() => {
    if (isEdit) return; // edit não auto-puxa pra não atropelar
    if (!clientId || clientId === PROFILE_NONE) return;
    let cancelled = false;
    fetchClienteEquipeAction(clientId).then((equipe) => {
      if (cancelled || !equipe) return;
      const equipeIds = [equipe.coordenador_id, equipe.assessor_id]
        .filter((id): id is string => !!id);
      if (equipeIds.length === 0) return;
      setParticipantes((prev) => Array.from(new Set([...prev, ...equipeIds])));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  /**
   * Auto-adiciona coordenador audiovisual quando demanda vira "video".
   * Chamado nos handlers de troca de tipo e de responsável. Usuário pode
   * remover se quiser — só atua nas transições pra "video".
   */
  function addCoordenadoresAvIfVideo(novoTipo: string) {
    if (isEdit) return;
    if (novoTipo !== "video") return;
    const coordenadoresAv = profiles
      .filter((p) => p.role === "audiovisual_chefe")
      .map((p) => p.id);
    if (coordenadoresAv.length === 0) return;
    setParticipantes((prev) => Array.from(new Set([...prev, ...coordenadoresAv])));
  }

  function addLink() {
    setLinks((prev) => [...prev, { label: "", url: "" }]);
  }
  function updateLink(i: number, patch: Partial<TaskLink>) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function toggleParticipante(id: string) {
    setParticipantes((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = ""; // reset pro mesmo arquivo poder ser upado de novo

    startUpload(async () => {
      for (const file of files) {
        const fd = new FormData();
        fd.set("file", file);
        const r = await uploadTaskAttachmentAction(taskId, fd);
        if ("error" in r) {
          setUploadError(r.error);
          break;
        }
        setAttachments((prev) => [...prev, r.url]);
      }
    });
  }

  async function onRemoveAttachment(url: string) {
    setAttachments((prev) => prev.filter((u) => u !== url));
    // best-effort delete; ignora erro
    await removeTaskAttachmentAction(url).catch(() => null);
  }

  // Filtra participantes pra excluir o atribuido principal (visualmente)
  const participantesVisiveis = participantes.filter((id) => id !== atribuidoA);
  const linksValidos = links.filter((l) => l.url.trim().length > 0);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={taskId} />
      <input type="hidden" name="participantes_ids" value={JSON.stringify(participantesVisiveis)} />
      <input type="hidden" name="links" value={JSON.stringify(linksValidos)} />
      <input type="hidden" name="attachment_urls" value={JSON.stringify(attachments)} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="formatos" value={JSON.stringify(requiresFormato ? formatos : [])} />

      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" defaultValue={defaults.titulo ?? ""} required minLength={2} maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea id="descricao" name="descricao" defaultValue={defaults.descricao ?? ""} rows={4} maxLength={4000} />
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="tipo-select">
              Tipo {requiresFormato && <span className="text-destructive">*</span>}
            </Label>
            {tipoAutoDetected && (
              <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                ✨ definido pelo responsável
              </span>
            )}
          </div>
          <Select value={tipo} onValueChange={(v) => onTipoChange(v ?? "geral")}>
            <SelectTrigger id="tipo-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="geral">Geral</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="arte">Arte</SelectItem>
            </SelectContent>
          </Select>
          {!requiresFormato && (
            <p className="text-[11px] text-muted-foreground">
              Marque como <strong>Vídeo</strong> ou <strong>Arte</strong> pra ativar formato, fluxo de aprovação e contagem no painel mensal.
            </p>
          )}
          {requiresFormato && (
            <p className="text-[11px] text-muted-foreground">
              {tipo === "arte" ? "Tarefa de arte (design)." : "Tarefa de vídeo (edição/captação)."} O painel mensal vai marcar a step de edição como pronta quando essa tarefa for concluída/aprovada/postada.
            </p>
          )}
        </div>

        {requiresFormato && (
          <div className="space-y-2 border-t pt-3">
            <Label>Formato <span className="text-destructive">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "feed", label: "Feed" },
                { value: "story", label: "Story" },
              ].map((f) => {
                const checked = formatos.includes(f.value);
                return (
                  <button
                    type="button"
                    key={f.value}
                    onClick={() => toggleFormato(f.value)}
                    className={
                      checked
                        ? "rounded-full border border-primary bg-primary/15 px-3 py-1 text-xs font-medium text-primary"
                        : "rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                    }
                  >
                    {checked ? "✓ " : ""}{f.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pode marcar mais de um (ex: feed + story).
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="client_id">Cliente (opcional)</Label>
          <input type="hidden" name="client_id" value={clientId === PROFILE_NONE ? "" : clientId} />
          <SearchableSelect
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
            value={clientId === PROFILE_NONE ? null : clientId}
            onChange={(v) => setClientId(v ?? PROFILE_NONE)}
            placeholder="Sem cliente"
            emptyText="Nenhum cliente encontrado"
            clearLabel="Sem cliente"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="atribuido_a">Responsável pela execução</Label>
          <input type="hidden" name="atribuido_a" value={atribuidoA} />
          <SearchableSelect
            options={profiles.map((p) => ({ value: p.id, label: p.nome }))}
            value={atribuidoA || null}
            onChange={(v) => onAtribuidoChange(v ?? "")}
            placeholder="Selecione"
            emptyText="Nenhum colaborador encontrado"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Atribuídos adicionais (opcional)</Label>
          <div className="flex flex-wrap gap-2">
            {participantesVisiveis.length === 0 && (
              <span className="text-xs text-muted-foreground py-1">
                {clientId === PROFILE_NONE
                  ? "Selecione um cliente pra adicionar coordenador e assessor automaticamente, ou inclua manualmente abaixo."
                  : "Nenhum adicional. Use o seletor abaixo pra incluir alguém."}
              </span>
            )}
            {participantesVisiveis.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                {nomeOf(profiles, id)}
                <button
                  type="button"
                  onClick={() => toggleParticipante(id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <SearchableSelect
            options={profiles
              .filter((p) => p.id !== atribuidoA && !participantes.includes(p.id))
              .map((p) => ({ value: p.id, label: p.nome }))}
            value={null}
            onChange={(v) => v && toggleParticipante(v)}
            placeholder="+ Adicionar atribuído"
            emptyText="Sem mais colaboradores pra adicionar"
            className="w-full md:w-64"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prioridade">Prioridade</Label>
          <Select name="prioridade" defaultValue={defaults.prioridade ?? "media"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date">Prazo</Label>
          <Input id="due_date" name="due_date" type="date" defaultValue={defaults.due_date ?? ""} />
        </div>

        {isEdit && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={defaults.status ?? "aberta"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Links de referência */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5" /> Links de referência (opcional)</Label>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Label (opcional)"
                value={l.label ?? ""}
                onChange={(e) => updateLink(i, { label: e.target.value })}
                className="w-40"
                maxLength={80}
              />
              <Input
                type="url"
                placeholder="https://..."
                value={l.url}
                onChange={(e) => updateLink(i, { url: e.target.value })}
                className="flex-1"
                maxLength={500}
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label="Remover link"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addLink}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar link
        </Button>
      </div>

      {/* Anexos */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Anexos / prints (opcional)</Label>
        <div className="rounded-lg border border-dashed bg-muted/20 p-4">
          <div className="flex flex-wrap gap-2">
            {attachments.map((url) => (
              <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-md border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(url)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/30 bg-card text-muted-foreground hover:bg-muted/40">
              <Upload className="h-4 w-4" />
              <span className="text-[10px]">{uploading ? "Enviando..." : "Adicionar"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={onUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Imagens: PNG, JPEG, WebP ou GIF. Máx 5MB cada, até 10 arquivos.
          </p>
          {uploadError && <p className="mt-1 text-xs text-destructive">{uploadError}</p>}
        </div>
      </div>

      {state?.error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Salvando..." : submitLabel}
        </Button>
        {cancelHref && (
          <Link href={cancelHref} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
