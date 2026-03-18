import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { listen } from "@tauri-apps/api/event";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Wifi } from "lucide-react";
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
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [setSynced]);

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-400" />
            <span className="text-sm text-slate-400 uppercase tracking-wider">Hora Atual</span>
          </div>
          {synced && (
            <div className="flex items-center gap-1 bg-green-600/30 border border-green-500/50 rounded-full px-2 py-0.5">
              <Wifi className="h-3 w-3 text-green-400" />
              <span className="text-xs text-green-400 font-medium">NTP</span>
            </div>
          )}
        </div>
        <div className="text-6xl font-mono font-bold tracking-tight">
          {format(now, "HH:mm:ss")}
        </div>
        <div className="text-slate-400 mt-1 capitalize">
          {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </div>
      </CardContent>
    </Card>
  );
}
