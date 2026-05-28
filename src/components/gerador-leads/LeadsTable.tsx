"use client";

import Link from "next/link";
import { Star, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadActions } from "./LeadActions";
import { STATUS_LEAD_DEFS } from "@/lib/gerador-leads/tipos";
import type { LeadGeradoRow } from "@/lib/gerador-leads/queries";

interface Props {
  leads: LeadGeradoRow[];
  canManage: boolean;
}

export function LeadsTable({ leads, canManage }: Props) {
  if (leads.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Nenhum lead encontrado nesse filtro.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {leads.map((lead) => (
        <LeadRow key={lead.id} lead={lead} canManage={canManage} />
      ))}
    </div>
  );
}

function LeadRow({ lead, canManage }: { lead: LeadGeradoRow; canManage: boolean }) {
  const statusDef = STATUS_LEAD_DEFS[lead.status as keyof typeof STATUS_LEAD_DEFS];

  return (
    <Card className="p-3 flex flex-wrap gap-3">
      {/* Empresa + meta */}
      <div className="flex-1 min-w-[240px] space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/gerador-leads/${lead.id}`}
            className="font-semibold text-sm hover:underline"
          >
            {lead.empresa}
          </Link>
          {statusDef && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusDef.color}`}>
              {statusDef.label}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {lead.categoria && (
            <span className="truncate max-w-[200px]" title={lead.categoria}>
              {lead.categoria}
            </span>
          )}
          {lead.cidade && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {lead.cidade}
              {lead.estado ? `/${lead.estado}` : ""}
            </span>
          )}
          {lead.google_rating !== null && (
            <span className="flex items-center gap-1 text-amber-600">
              <Star className="h-3 w-3 fill-current" />
              {lead.google_rating.toFixed(1)}
              {lead.google_reviews_count !== null && (
                <span className="text-muted-foreground">
                  ({lead.google_reviews_count})
                </span>
              )}
            </span>
          )}
        </div>

        {lead.cnpj && (
          <p className="text-[11px] text-muted-foreground">
            CNPJ {lead.cnpj}
          </p>
        )}

        {lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {lead.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[9px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="ml-auto">
        <LeadActions lead={lead} canManage={canManage} />
      </div>
    </Card>
  );
}
