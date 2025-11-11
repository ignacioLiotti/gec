"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function NotificationsPlaygroundPage() {
  const [obraName, setObraName] = useState("Obra Demo");
  const [obraId, setObraId] = useState("");
  const [followUpMinutes, setFollowUpMinutes] = useState(2);
  const [notifyUserId, setNotifyUserId] = useState("");
  const [documentName, setDocumentName] = useState("Póliza");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");

  async function emit(type: string, ctx: any) {
    setLoading(type);
    setResult("");
    try {
      const res = await fetch("/api/notifications/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ctx }),
      });
      const json = await res.json().catch(() => ({}));
      setResult(res.ok ? "OK" : JSON.stringify(json));
    } catch (e) {
      setResult("failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Notifications Playground</h1>
      <div className="rounded-md border p-4 space-y-4">
        <div className="text-lg font-medium">Obra completada</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Obra ID (opcional)</label>
            <Input value={obraId} onChange={(e) => setObraId(e.target.value)} placeholder="uuid" />
          </div>
          <div>
            <label className="block text-sm mb-1">Nombre</label>
            <Input value={obraName} onChange={(e) => setObraName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Follow-up (min)</label>
            <Input type="number" value={followUpMinutes} onChange={(e) => setFollowUpMinutes(Number(e.target.value || 0))} />
          </div>
          <div>
            <label className="block text-sm mb-1">Actor user_id (opcional)</label>
            <Input value={notifyUserId} onChange={(e) => setNotifyUserId(e.target.value)} placeholder="user uuid for recipient" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              emit("obra.completed", {
                actorId: notifyUserId || null,
                obra: { id: obraId || undefined, name: obraName, percentage: 100 },
                followUpAt: new Date(Date.now() + followUpMinutes * 60 * 1000).toISOString(),
              })
            }
            disabled={loading !== null}
          >
            Emitir evento
          </Button>
        </div>
      </div>

      <Separator />

      <div className="rounded-md border p-4 space-y-4">
        <div className="text-lg font-medium">Recordatorio de documento</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Obra ID</label>
            <Input value={obraId} onChange={(e) => setObraId(e.target.value)} placeholder="uuid" />
          </div>
          <div>
            <label className="block text-sm mb-1">Documento</label>
            <Input value={documentName} onChange={(e) => setDocumentName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Vencimiento (YYYY-MM-DD)</label>
            <Input value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="2025-12-31" />
          </div>
          <div>
            <label className="block text-sm mb-1">Notificar a user_id</label>
            <Input value={notifyUserId} onChange={(e) => setNotifyUserId(e.target.value)} placeholder="user uuid" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              emit("document.reminder.requested", {
                obraId,
                obraName: obraName || null,
                documentName,
                dueDate,
                notifyUserId,
              })
            }
            disabled={loading !== null}
          >
            Programar recordatorio
          </Button>
        </div>
      </div>

      {result && (
        <div className="rounded-md border p-3 text-sm">Resultado: {result}</div>
      )}
    </div>
  );
}










