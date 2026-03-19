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
      <Card className="border-dashed border-2 border-slate-200 bg-slate-50">
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[172px] text-center gap-2">
          <div className="h-11 w-11 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <BellOff className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Próximo Sinal</p>
          <p className="text-xs text-slate-400">Nenhum agendamento ativo</p>
        </CardContent>
      </Card>
    );
  }

  const { schedule } = nextSignal;
  const label = schedule.name?.trim() || null;

  const gradientClass = isUrgent
    ? "bg-gradient-to-br from-orange-500 to-orange-600 border-orange-400"
    : "bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500";
  const mutedClass = isUrgent ? "text-orange-200" : "text-blue-200";

  return (
    <Card className={`border text-white overflow-hidden ${gradientClass}`}>
      <CardContent className="p-6 flex flex-col justify-between h-full min-h-[172px]">
        <div className="flex items-center gap-2">
          <Bell className={`h-4 w-4 ${mutedClass}`} />
          <span className={`text-xs uppercase tracking-widest font-medium ${mutedClass}`}>Próximo Sinal</span>
          {isUrgent && (
            <span className="ml-auto text-xs bg-white/20 rounded-full px-2 py-0.5 font-medium">Em breve!</span>
          )}
        </div>

        <div className="flex items-end justify-between mt-4">
          <div>
            <div className="text-5xl font-mono font-bold tabular-nums leading-none">
              {schedule.time}
            </div>
            {label && <p className={`text-sm mt-1.5 ${mutedClass}`}>{label}</p>}
          </div>

          <div className="text-right">
            <div className={`text-xs ${mutedClass} mb-0.5`}>em</div>
            <div className="text-3xl font-mono font-bold tabular-nums leading-none">
              {formatCountdown(countdown)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
