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
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/50 shadow-xl overflow-hidden relative group h-full">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-emerald-500 opacity-10 rounded-full blur-2xl pointer-events-none" />
      
      <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full min-h-[172px] transition-transform duration-300 group-hover:scale-[1.01]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5 bg-white/5 rounded-full px-3 py-1 border border-white/10 backdrop-blur-sm shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </span>
            <span className="text-xs text-slate-200 uppercase tracking-widest font-semibold pt-0.5">
              Horário Local
            </span>
          </div>
          {synced && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md rounded-full px-2.5 py-1 shadow-sm">
              <Wifi className="h-3 w-3 text-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">NTP Sync</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-start justify-end mt-auto">
          <div className="text-[3.5rem] leading-none font-mono font-bold tracking-tighter tabular-nums drop-shadow-md text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-300">
            {format(now, "HH:mm:ss")}
          </div>
          <div className="flex items-center mt-3 gap-2">
            <span className="bg-white/10 text-slate-300 capitalize text-xs font-medium px-2 py-0.5 rounded-md border border-white/5 backdrop-blur-sm drop-shadow-sm">
              {format(now, "EEEE", { locale: ptBR })}
            </span>
            <span className="text-slate-400 text-sm font-medium">
              {format(now, "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
