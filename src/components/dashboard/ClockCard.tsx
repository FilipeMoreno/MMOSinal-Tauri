import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { listen } from "@tauri-apps/api/event";
import { Card, CardContent } from "@/components/ui/card";
import { Wifi } from "lucide-react";
import { useSyncStore } from "@/stores/syncStore";

export function ClockCard() {
  const [now, setNow] = useState(new Date());
  const { synced, setSynced } = useSyncStore();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ offset_s: number; ntp_time: string; applied: boolean }>("time-synced", (event) => {
      setSynced(true, event.payload.offset_s);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [setSynced]);

  return (
    <Card className="bg-white border-slate-200 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-xs text-slate-400 uppercase tracking-widest font-medium">Hora Atual</span>
          </div>
          {synced && (
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <Wifi className="h-3 w-3 text-green-600" />
              <span className="text-xs text-green-600 font-semibold">NTP</span>
            </div>
          )}
        </div>

        <div className="text-5xl font-mono font-bold tracking-tight tabular-nums text-slate-800">
          {format(now, "HH:mm:ss")}
        </div>
        <div className="text-slate-400 mt-2 text-sm capitalize">
          {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </div>
      </CardContent>
    </Card>
  );
}
