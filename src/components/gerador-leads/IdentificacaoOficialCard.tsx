import { Building2, AlertTriangle, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCnpj } from "@/lib/gerador-leads/utils/cnpj";

interface Socio {
  nome: string;
  qualificacao: string;
  data_entrada: string | null;
}

interface Props {
  cnpj: string | null;
  socios: Socio[];
  multiplos_resultados?: boolean;
}

function isAdministrador(qualificacao: string): boolean {
  return qualificacao.toLowerCase().includes("administrador");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function IdentificacaoOficialCard({ cnpj, socios, multiplos_resultados }: Props) {
  if (!cnpj) return null;

  const cnpjFormatted = formatCnpj(cnpj);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="h-4 w-4 text-primary" />
          Identificação oficial
        </h2>
        <Badge variant="outline" className="text-[10px]">Fonte: Receita Federal</Badge>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CNPJ</p>
        <a
          href={`https://cnpj.biz/${cnpj}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-mono hover:underline"
        >
          {cnpjFormatted}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {multiplos_resultados && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Mais de uma empresa com nome parecido foi encontrada. Confirme manualmente se o CNPJ acima é o correto.
          </span>
        </div>
      )}

      {socios.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Sócios oficiais
          </p>
          <ul className="space-y-2">
            {socios.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{s.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {formatDate(s.data_entrada)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    isAdministrador(s.qualificacao)
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : ""
                  }
                >
                  {s.qualificacao}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
