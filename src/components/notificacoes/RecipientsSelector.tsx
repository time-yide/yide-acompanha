"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";

interface RoleOption { value: string; label: string; }
interface ProfileOption { id: string; nome: string; }

interface Props {
  initialRoles: string[];
  initialUserIds: string[];
  roleOptions: RoleOption[];
  profileOptions: ProfileOption[];
}

export function RecipientsSelector({ initialRoles, initialUserIds, roleOptions, profileOptions }: Props) {
  const [roles, setRoles] = useState<string[]>(initialRoles);
  const [userIds, setUserIds] = useState<string[]>(initialUserIds);

  function toggleRole(r: string) {
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }
  function toggleUser(id: string) {
    setUserIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-[11px]">Papéis padrão</Label>
        <div className="flex flex-wrap gap-1.5">
          {roleOptions.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => toggleRole(r.value)}
              className={`text-xs rounded-full border px-2 py-1 transition-colors ${
                roles.includes(r.value)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {roles.map((r) => <input key={r} type="hidden" name="default_roles" value={r} />)}
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Usuários específicos</Label>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {profileOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleUser(p.id)}
              className={`text-xs rounded-full border px-2 py-1 transition-colors ${
                userIds.includes(p.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.nome}
            </button>
          ))}
        </div>
        {userIds.map((u) => <input key={u} type="hidden" name="default_user_ids" value={u} />)}
      </div>
    </div>
  );
}
