import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { GmbForm } from "@/components/clientes/gmb/GmbForm";
import { buttonVariants } from "@/components/ui/button";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor"];

export default async function GmbPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect(`/clientes/${id}`);

  // Service role — RLS de clientes pode bloquear leitura por role específico;
  // página já gated por requireAuth + role check.
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: cliente } = await sbAny
    .from("clients")
    .select("gmb_link, gmb_place_id, gmb_rating, gmb_review_count, gmb_last_update_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!cliente) notFound();

  const placesApiEnabled = !!process.env.GOOGLE_PLACES_API_KEY;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <GmbForm
        clientId={id}
        placesApiEnabled={placesApiEnabled}
        initialValues={{
          gmb_link: cliente.gmb_link ?? null,
          gmb_place_id: cliente.gmb_place_id ?? null,
          gmb_rating: cliente.gmb_rating !== null ? Number(cliente.gmb_rating) : null,
          gmb_review_count: cliente.gmb_review_count ?? null,
          gmb_last_update_at: cliente.gmb_last_update_at ?? null,
        }}
      />

      {/* Link rápido pro painel-gmb individual do cliente — onde tá o
          gráfico de evolução. Mantém esta página focada na edição. */}
      <div className="flex justify-end">
        <Link
          href={`/painel-gmb/${id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <TrendingUp className="mr-1.5 h-4 w-4" />
          Ver histórico e gráfico
        </Link>
      </div>
    </div>
  );
}
