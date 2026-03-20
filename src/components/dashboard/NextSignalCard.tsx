import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useScheduleStore } from "@/stores/scheduleStore";

export function NextSignalCard() {
  const { nextSignal, fetchNextSignal } = useScheduleStore();
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    fetchNextSignal();
    const id = setInterval(fetchNextSignal, 10_000);
    return () => clearInterval(id);
  }, [fetchNextSignal]);

  useEffect(() => {
    if (!nextSignal) return;
    setCountdown(nextSignal.seconds_until);
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [nextSignal]);

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
    return `${s}s`;
  };

  const isUrgent = countdown > 0 && countdown <= 300;

  if (!nextSignal) {
    return (
      <Card className="border-dashed border-2 border-slate-200 bg-slate-50 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-transparent opacity-50 pointer-events-none" />
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[172px] text-center gap-3 relative z-10 transition-transform group-hover:scale-[1.02] duration-300 ease-out">
          <div className="h-12 w-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
            <BellOff className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Próximo Sinal</p>
            <p className="text-xs text-slate-400 mt-0.5">Nenhum agendamento ativo</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { schedule } = nextSignal;
  const label = schedule.name?.trim() || null;

  // Calcular o dia da semana do próximo sinal
  const signalDate = new Date(Date.now() + countdown * 1000);
  let weekDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(signalDate);
  weekDay = weekDay.charAt(0).toUpperCase() + weekDay.slice(1);

  const gradientClass = isUrgent
    ? "bg-gradient-to-br from-orange-500 via-orange-500/90 to-red-500 border-orange-400/50 shadow-lg shadow-orange-500/20"
    : "bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 border-indigo-400/50 shadow-lg shadow-indigo-500/20";
  const mutedClass = isUrgent ? "text-orange-100" : "text-indigo-100";
  const pulseClass = isUrgent ? "animate-pulse" : "";

  return (
    <Card className={`relative overflow-hidden text-white transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border ${gradientClass}`}>
      {/* Dynamic Background Effects */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-white opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className={`absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl pointer-events-none ${pulseClass}`} />

      <CardContent className="relative z-10 p-6 flex flex-col justify-between h-full min-h-[172px]">
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center h-8 w-8 rounded-full bg-white/20 backdrop-blur-md shadow-inner border border-white/20 ${isUrgent ? 'animate-bounce' : ''}`}>
            <Bell className={`h-4 w-4 text-white`} />
          </div>
          <span className={`text-xs uppercase tracking-widest font-bold ${mutedClass}`}>
            Próximo Sinal
          </span>
          {isUrgent && (
            <span className="ml-auto text-xs bg-white text-orange-600 rounded-full px-2.5 py-0.5 font-bold shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-[ping_1s_cubic-bezier(0,0,0.2,1)_infinite]" />
              Em breve!
            </span>
          )}
        </div>

        <div className="flex items-end justify-between mt-5">
          <div className="flex flex-col items-start">
            <div className="text-5xl font-bold tracking-tight leading-none drop-shadow-sm">
              {schedule.time}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-sm font-medium bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/10 drop-shadow-sm ${mutedClass}`}>
                {weekDay}
              </span>
              {label && (
                <span className={`text-sm font-medium bg-black/10 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/10 ${mutedClass}`}>
                  {label}
                </span>
              )}
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <span className={`text-xs uppercase font-semibold tracking-wider mb-1 ${mutedClass}`}>Faltam</span>
            <div className="text-3xl font-mono font-bold tabular-nums leading-none tracking-tight drop-shadow-sm bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 backdrop-blur-md">
              {formatCountdown(countdown)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
