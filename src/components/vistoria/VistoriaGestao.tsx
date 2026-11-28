"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Printer, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { criarEquipamentoAction, editarEquipamentoAction, prepareFotoEquipamentoUpload, setExigirComprovacaoAction, setTravaSemanalAction } from "@/lib/vistoria/actions";
import { Switch } from "@/components/ui/switch";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORIAS_EQUIPAMENTO, CATEGORIA_LABEL, STATUS_EQUIPAMENTO, STATUS_EQUIPAMENTO_LABEL,
  ESTADO_CONFERENCIA_LABEL, progressoVistoria, resumoEstoque, type CategoriaEquipamento, type EstadoConferencia, type StatusEquipamento,
} from "@/lib/vistoria/core";
import type { ConferenciaPessoa, EquipamentoRow, LeituraSemana, PessoaOpcao } from "@/lib/vistoria/queries";
import { cn } from "@/lib/utils";

interface Props {
  equipamentos: EquipamentoRow[];
  pessoas: PessoaOpcao[];
  conferencia: ConferenciaPessoa[];
  leituras: LeituraSemana[];
  exigirComprovacao: boolean;
  travaAtiva: boolean;
  semanaLabel: string;
}

type Form = {
  id?: string;
  nome: string;
  categoria: CategoriaEquipamento;
  marca: string;
  modelo: string;
  numero_serie: string;
  status: StatusEquipamento;
  responsavel_id: string;
  observacao: string;
  foto_url: string;
  /** Arquivo escolhido agora (ainda não subiu). */
  fotoArquivo: File | null;
  fotoPreview: string | null;
};

const VAZIO: Form = {
  nome: "", categoria: "outro", marca: "", modelo: "", numero_serie: "",
  status: "ativo", responsavel_id: "", observacao: "", foto_url: "", fotoArquivo: null, fotoPreview: null,
};

const CAMPO = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function VistoriaGestao({ equipamentos, pessoas, conferencia, leituras, exigirComprovacao, travaAtiva, semanaLabel }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<Form | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");

  const resumo = useMemo(() => resumoEstoque(equipamentos), [equipamentos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return equipamentos.filter((e) => {
      if (filtroCategoria !== "todas" && e.categoria !== filtroCategoria) return false;
      if (!termo) return true;
      return [e.nome, e.codigo, e.marca, e.modelo, e.responsavel_nome]
        .some((v) => (v ?? "").toLowerCase().includes(termo));
    });
  }, [equipamentos, busca, filtroCategoria]);

  function alternarTrava(ligada: boolean) {
    start(async () => {
      const r = await setTravaSemanalAction(ligada);
      if ("error" in r && r.error) { toast.error(r.error); return; }
      toast.success(ligada ? "Trava semanal ligada: quem tem equipamento precisa conferir" : "Trava semanal desligada");
      router.refresh();
    });
  }

  function alternarComprovacao(ligado: boolean) {
    start(async () => {
      const r = await setExigirComprovacaoAction(ligado);
      if ("error" in r && r.error) { toast.error(r.error); return; }
      toast.success(ligado ? "Comprovação ligada: cada leitura exige foto e estado" : "Comprovação desligada");
      router.refresh();
    });
  }

  function escolherFoto(arquivo: File | null) {
    if (!form) return;
    setForm({ ...form, fotoArquivo: arquivo, fotoPreview: arquivo ? URL.createObjectURL(arquivo) : null });
  }

  function salvar() {
    if (!form) return;
    start(async () => {
      // 1) Foto: sobe direto pro Storage (o Server Action não aceita arquivo grande).
      let fotoPath: string | null = null;
      if (form.fotoArquivo) {
        const arquivo = form.fotoArquivo;
        const prep = await prepareFotoEquipamentoUpload(arquivo.type, arquivo.size);
        if ("error" in prep) { toast.error(prep.error); return; }
        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from("vistoria-equipamentos")
          .uploadToSignedUrl(prep.path, prep.token, arquivo, { contentType: arquivo.type });
        if (upErr) { toast.error(`Falha no upload da foto: ${upErr.message}`); return; }
        fotoPath = prep.path;
      }
      if (!form.id && !fotoPath) { toast.error("Adicione a foto do equipamento"); return; }

      // 2) Dados + QR: o código é gerado no servidor ao cadastrar.
      const payload = {
        nome: form.nome,
        categoria: form.categoria,
        marca: form.marca || null,
        modelo: form.modelo || null,
        numero_serie: form.numero_serie || null,
        status: form.status,
        responsavel_id: form.responsavel_id || null,
        observacao: form.observacao || null,
        foto_path: fotoPath,
      };
      const r = form.id
        ? await editarEquipamentoAction({ ...payload, id: form.id })
        : await criarEquipamentoAction(payload);
      if ("error" in r && r.error) { toast.error(r.error); return; }
      if (form.id) {
        toast.success("Equipamento atualizado");
      } else {
        toast.success(`Cadastrado. QR ${"codigo" in r ? r.codigo : ""}`, {
          description: "Imprima a etiqueta e cole no equipamento.",
          action: { label: "Imprimir etiqueta", onClick: () => router.push("/vistoria/etiquetas") },
        });
      }
      setForm(null);
      router.refresh();
    });
  }

  function abrirEdicao(e: EquipamentoRow) {
    setForm({
      id: e.id,
      nome: e.nome,
      categoria: e.categoria,
      marca: e.marca ?? "",
      modelo: e.modelo ?? "",
      numero_serie: e.numero_serie ?? "",
      status: e.status,
      responsavel_id: e.responsavel_id ?? "",
      observacao: e.observacao ?? "",
      foto_url: e.foto_url ?? "",
      fotoArquivo: null,
      fotoPreview: null,
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Estoque</h2>
            <p className="text-sm text-muted-foreground">Tudo que a Yide tem em equipamento, quem está com o quê.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/vistoria/etiquetas" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Printer className="mr-2 h-4 w-4" /> Etiquetas QR
            </Link>
            <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
              <Plus className="mr-2 h-4 w-4" /> Novo equipamento
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat titulo="Total" valor={resumo.total} />
          <Stat titulo="No estoque" valor={resumo.noEstoque} destaque />
          <Stat titulo="Com alguém" valor={resumo.comResponsavel} />
          <Stat titulo="Manutenção" valor={resumo.emManutencao} />
          <Stat titulo="Baixados" valor={resumo.baixados} />
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, código, marca, responsável..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select className={cn(CAMPO, "w-auto min-w-[180px]")} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
            <option value="todas">Todas as categorias</option>
            {CATEGORIAS_EQUIPAMENTO.map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABEL[c]} ({resumo.porCategoria[c] ?? 0})</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Foto</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Equipamento</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Com quem</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtrados.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nenhum equipamento encontrado.</td></tr>
              )}
              {filtrados.map((e) => (
                <tr key={e.id} className={cn(e.status === "baixado" && "text-muted-foreground line-through")}>
                  <td className="px-3 py-2">
                    <Miniatura src={e.foto_url} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.codigo}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{e.nome}</p>
                    {(e.marca || e.modelo) && <p className="text-xs text-muted-foreground">{[e.marca, e.modelo].filter(Boolean).join(" ")}</p>}
                  </td>
                  <td className="px-3 py-2">{CATEGORIA_LABEL[e.categoria] ?? e.categoria}</td>
                  <td className="px-3 py-2">{e.responsavel_nome ?? <span className="text-muted-foreground">No estoque</span>}</td>
                  <td className="px-3 py-2">{STATUS_EQUIPAMENTO_LABEL[e.status]}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => abrirEdicao(e)} aria-label={`Editar ${e.nome}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="max-w-xl">
          <p className="font-medium">Trava semanal (conferência obrigatória)</p>
          <p className="text-sm text-muted-foreground">
            Ligada, quem tem equipamento fica travado no sistema toda segunda até concluir a conferência. Desligada, ninguém é travado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{travaAtiva ? "Ligada" : "Desligada"}</span>
          <Switch checked={travaAtiva} onCheckedChange={alternarTrava} disabled={pending} aria-label="Trava semanal da conferência" />
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="max-w-xl">
          <p className="font-medium">Comprovação na conferência</p>
          <p className="text-sm text-muted-foreground">
            Quando ligada, cada leitura exige foto do equipamento e o estado (funcionando ou com defeito). Desligada por padrão.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{exigirComprovacao ? "Ligada" : "Desligada"}</span>
          <Switch checked={exigirComprovacao} onCheckedChange={alternarComprovacao} disabled={pending} aria-label="Exigir comprovação na conferência" />
        </div>
      </section>

      <section className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold tracking-tight">Conferência da semana</h2>
          <p className="text-sm text-muted-foreground">Semana de {semanaLabel}. Quanto cada pessoa já bateu.</p>
        </header>
        {conferencia.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Ninguém está com equipamento no momento.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Pessoa</th>
                  <th className="px-3 py-2">Conferidos</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {conferencia.map((c) => {
                  const p = progressoVistoria(c.total, c.conferidos);
                  return (
                    <tr key={c.responsavel_id}>
                      <td className="px-3 py-2 font-medium">{c.nome}</td>
                      <td className="px-3 py-2">{p.conferidos} de {p.total}</td>
                      <td className="px-3 py-2">
                        {c.concluidaEm ? (
                          p.faltando > 0 ? (
                            <span className="text-amber-700 dark:text-amber-400">Concluída, faltam {p.faltando}</span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400">Concluída</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">Em aberto</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold tracking-tight">Leituras da semana</h2>
          <p className="text-sm text-muted-foreground">Cada QR lido, com quem leu e a comprovação quando houver.</p>
        </header>
        {leituras.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Nenhuma leitura ainda nesta semana.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Foto</th>
                  <th className="px-3 py-2">Equipamento</th>
                  <th className="px-3 py-2">Quem leu</th>
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leituras.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2"><Miniatura src={l.foto_url} /></td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{l.equipamento_nome}</p>
                      <p className="font-mono text-xs text-muted-foreground">{l.codigo}</p>
                    </td>
                    <td className="px-3 py-2">{l.pessoa_nome}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(l.lida_em).toLocaleString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2">
                      {l.estado ? (
                        <span className={l.estado === "defeito" ? "text-amber-700 dark:text-amber-400" : ""}>
                          {ESTADO_CONFERENCIA_LABEL[l.estado as EstadoConferencia] ?? l.estado}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">sem comprovação</span>
                      )}
                      {l.observacao && <p className="text-xs text-muted-foreground">{l.observacao}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
            <DialogDescription>
              {form?.id ? "O código do QR não muda." : "O código do QR é gerado sozinho ao salvar. Imprima a etiqueta e cole no equipamento."}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 text-sm sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Foto {form.id ? "(opcional, troca a atual)" : "*"}
                </span>
                <div className="flex items-center gap-3">
                  {(form.fotoPreview || form.foto_url) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={form.fotoPreview ?? form.foto_url} alt="" className="h-20 w-20 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">sem foto</div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5"
                    onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Nome *</span>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Sony A7 III" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Categoria</span>
                <select className={CAMPO} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaEquipamento })}>
                  {CATEGORIAS_EQUIPAMENTO.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <select className={CAMPO} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusEquipamento })}>
                  {STATUS_EQUIPAMENTO.map((s) => <option key={s} value={s}>{STATUS_EQUIPAMENTO_LABEL[s]}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Marca</span>
                <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Modelo</span>
                <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Número de série</span>
                <Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Com quem está</span>
                <select className={CAMPO} value={form.responsavel_id} onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}>
                  <option value="">No estoque (ninguém)</option>
                  {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Observação</span>
                <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)} disabled={pending}>Cancelar</Button>
            <Button onClick={salvar} disabled={pending || !form?.nome.trim() || (!form.id && !form.foto_url && !form.fotoArquivo)}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Miniatura({ src }: { src: string | null }) {
  if (!src) return <div className="h-10 w-10 rounded bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-10 w-10 rounded object-cover" />;
}

function Stat({ titulo, valor, destaque }: { titulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-3", destaque && "border-primary/40 bg-primary/5")}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
