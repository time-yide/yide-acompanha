import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArquivarButton } from "@/components/colaboradores/ArquivarButton";

export function StatusCard({
  userId,
  userNome,
  ativo,
  isSelf,
}: {
  userId: string;
  userNome: string;
  ativo: boolean;
  isSelf: boolean;
}) {
  return (
    <Card className="p-6">
      <h2 className="mb-2 text-lg font-semibold">Status</h2>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Atualmente:</span>
        {ativo ? (
          <Badge
            variant="outline"
            className="border-green-500/40 text-green-600 dark:text-green-400"
          >
            Ativo
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Arquivado
          </Badge>
        )}
      </div>

      {isSelf ? (
        <p className="text-sm text-muted-foreground">
          Você não pode arquivar/desarquivar a si mesmo.
        </p>
      ) : ativo ? (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Arquivar remove o colaborador das listagens e relatórios mensais. O histórico permanece.
          </p>
          <ArquivarButton userId={userId} userNome={userNome} acao="arquivar" />
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Desarquivar restaura o colaborador para as listagens e relatórios.
          </p>
          <ArquivarButton userId={userId} userNome={userNome} acao="desarquivar" />
        </>
      )}
    </Card>
  );
}
