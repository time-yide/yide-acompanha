"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Calendar, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  subscribePushAction,
  unsubscribePushAction,
  sendTestPushAction,
  sendTestEventTomorrowAction,
  sendTestEvent30MinAction,
} from "@/lib/push/actions";

interface Props {
  vapidPublicKey: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function EnablePushButton({ vapidPublicKey }: Props) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    // setTimeout(0) tira o setState do body do effect (regra
    // react-hooks/set-state-in-effect). UX não muda — roda no próximo tick.
    const t = setTimeout(() => {
      if (cancelled) return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setSupported(false);
        setSubscribed(false);
        return;
      }
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (!cancelled) setSubscribed(!!sub);
        })
        .catch(() => {
          if (!cancelled) setSubscribed(false);
        });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  async function handleEnable() {
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permissão de notificação negada. Habilite nas configurações do browser.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      // applicationServerKey aceita BufferSource. Cast pra contornar
      // mismatch entre ArrayBufferLike (do nosso helper) e ArrayBuffer
      // estrito (que o lib.dom espera).
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
      });

      const json = sub.toJSON();
      const fd = new FormData();
      fd.set("endpoint", sub.endpoint);
      fd.set("p256dh", json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh")));
      fd.set("auth", json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth")));
      fd.set("user_agent", navigator.userAgent);

      const r = await subscribePushAction(fd);
      if (r.error) {
        toast.error(r.error);
        await sub.unsubscribe().catch(() => {});
        return;
      }
      setSubscribed(true);
      toast.success("Notificações ativadas neste dispositivo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar notificações");
    } finally {
      setPending(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const fd = new FormData();
        fd.set("endpoint", sub.endpoint);
        await unsubscribePushAction(fd);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notificações desativadas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desativar");
    } finally {
      setPending(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Esse browser não suporta Web Push. Use Chrome, Edge, Firefox ou Safari 16.4+.
      </p>
    );
  }

  if (subscribed === null) {
    return <Button variant="outline" disabled>Carregando...</Button>;
  }

  async function handleTest() {
    setPending(true);
    try {
      const r = await sendTestPushAction();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Notificação enviada — confira o sininho do iPhone/Mac");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar teste");
    } finally {
      setPending(false);
    }
  }

  async function handleTestTomorrow() {
    setPending(true);
    try {
      const r = await sendTestEventTomorrowAction();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Push de teste do digest 18h enviado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar teste");
    } finally {
      setPending(false);
    }
  }

  async function handleTest30Min() {
    setPending(true);
    try {
      const r = await sendTestEvent30MinAction();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Push de teste do lembrete 30min enviado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar teste");
    } finally {
      setPending(false);
    }
  }

  if (subscribed) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleTest} disabled={pending}>
            <Send className="mr-1.5 h-4 w-4" />
            {pending ? "Enviando..." : "Enviar notificação de teste"}
          </Button>
          <Button type="button" variant="outline" onClick={handleDisable} disabled={pending}>
            <BellOff className="mr-1.5 h-4 w-4" />
            Desativar neste dispositivo
          </Button>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Testar formatos específicos:
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleTestTomorrow} disabled={pending}>
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              Testar &quot;Eventos de amanhã&quot;
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleTest30Min} disabled={pending}>
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Testar &quot;30 min antes&quot;
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Button type="button" onClick={handleEnable} disabled={pending}>
      <Bell className="mr-1.5 h-4 w-4" />
      {pending ? "Ativando..." : "Ativar notificações neste dispositivo"}
    </Button>
  );
}
