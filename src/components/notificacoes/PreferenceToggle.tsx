"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setPreferenceAction } from "@/lib/notificacoes/rule-actions";

interface Props {
  evento_tipo: string;
  label: string;
  initialInApp: boolean;
  initialEmail: boolean;
}

export function PreferenceToggle({ evento_tipo, label, initialInApp, initialEmail }: Props) {
  const [inApp, setInApp] = useState(initialInApp);
  const [email, setEmail] = useState(initialEmail);
  const [pending, startTransition] = useTransition();

  function update(nextInApp: boolean, nextEmail: boolean) {
    setInApp(nextInApp);
    setEmail(nextEmail);
    const fd = new FormData();
    fd.set("evento_tipo", evento_tipo);
    fd.set("in_app", nextInApp ? "on" : "");
    fd.set("email", nextEmail ? "on" : "");
    startTransition(async () => {
      await setPreferenceAction(fd);
    });
  }

  return (
    <div className="flex items-center justify-between rounded-md border bg-card p-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Switch
            id={`inapp-${evento_tipo}`}
            checked={inApp}
            disabled={pending}
            onCheckedChange={(v) => update(v, email)}
          />
          <Label htmlFor={`inapp-${evento_tipo}`} className="text-[11px]">In-app</Label>
        </div>
        <div className="flex items-center gap-1">
          <Switch
            id={`email-${evento_tipo}`}
            checked={email}
            disabled={pending}
            onCheckedChange={(v) => update(inApp, v)}
          />
          <Label htmlFor={`email-${evento_tipo}`} className="text-[11px]">Email</Label>
        </div>
      </div>
    </div>
  );
}
