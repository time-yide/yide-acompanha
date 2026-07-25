"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSignature, Loader2, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarInfoContratoPortalAction } from "@/lib/contratos/portal-actions";
import type { ContratoInfo } from "@/lib/contratos/queries";

type FormState = {
  razao_social: string;
  cnpj_cpf: string;
  endereco: string;
  email: string;
  telefone: string;
};

function fromInfo(info: ContratoInfo | null): FormState {
  return {
    razao_social: info?.razao_social ?? "",
    cnpj_cpf: info?.cnpj_cpf ?? "",
    endereco: info?.endereco ?? "",
    email: info?.email ?? "",
    telefone: info?.telefone ?? "",
  };
}

export function InfoContratoPortalSection({
  info,
  previewMode = false,
}: {
  info: ContratoInfo | null;
  previewMode?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormState>(() => fromInfo(info));
  const preenchido = !!info?.razao_social;

  function salvar() {
    if (!form.razao_social.trim()) { toast.error("Informe a razão social / nome."); return; }
    if (!form.cnpj_cpf.trim()) { toast.error("Informe o CNPJ / CPF."); return; }
    const fd = new FormData();
    fd.set("razao_social", form.razao_social.trim());
    fd.set("cnpj_cpf", form.cnpj_cpf.trim());
    fd.set("endereco", form.endereco.trim());
    fd.set("email", form.email.trim());
    fd.set("telefone", form.telefone.trim());
    start(async () => {
      const r = await salvarInfoContratoPortalAction(undefined, fd);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Informações enviadas! A Yide já recebeu.");
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <FileSignature className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Informações para contrato</h2>
            <p className="text-xs text-muted-foreground">Dados da empresa que a Yide usa pra emitir o contrato.</p>
          </div>
        </div>
        {!previewMode && !aberto && (
          <Button type="button" size="sm" onClick={() => { setForm(fromInfo(info)); setAberto(true); }} disabled={pending}>
            {preenchido ? <><Pencil className="mr-2 h-4 w-4" /> Atualizar</> : <><FileSignature className="mr-2 h-4 w-4" /> Preencher</>}
          </Button>
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {previewMode && (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Só o cliente logado preenche estas informações.
          </p>
        )}

        {!previewMode && aberto ? (
          <div className="space-y-2">
            <Campo label="Razão social / Nome *" value={form.razao_social} onChange={(v) => setForm({ ...form, razao_social: v })} placeholder="Empresa LTDA ou seu nome" />
            <Campo label="CNPJ / CPF *" value={form.cnpj_cpf} onChange={(v) => setForm({ ...form, cnpj_cpf: v })} placeholder="00.000.000/0000-00" />
            <Campo label="Endereço" value={form.endereco} onChange={(v) => setForm({ ...form, endereco: v })} placeholder="Rua, número, bairro, cidade — UF" />
            <Campo label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="contato@empresa.com" />
            <Campo label="Telefone" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} placeholder="(00) 00000-0000" />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>Cancelar</Button>
              <Button type="button" size="sm" onClick={salvar} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar
              </Button>
            </div>
          </div>
        ) : previewMode ? null : preenchido ? (
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <Item label="Razão social / Nome" valor={info!.razao_social} />
            <Item label="CNPJ / CPF" valor={info!.cnpj_cpf} />
            <Item label="Endereço" valor={info!.endereco} full />
            <Item label="E-mail" valor={info!.email} />
            <Item label="Telefone" valor={info!.telefone} />
          </dl>
        ) : (
          <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
            Ainda não preenchido. Clique em “Preencher” pra enviar os dados do contrato.
          </p>
        )}

        {!previewMode && preenchido && !aberto && (
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" /> Enviado. Pode atualizar quando precisar.
          </p>
        )}
      </div>
    </section>
  );
}

function Item({ label, valor, full }: { label: string; valor: string | null; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{valor || "—"}</dd>
    </div>
  );
}

function Campo({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
