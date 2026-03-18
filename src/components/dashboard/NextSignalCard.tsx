import { useEffect, useState } from "react";
import { Bell, Music, Folder, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useScheduleStore } from "@/stores/scheduleStore";
import { DAY_NAMES, formatSecondsToDisplay } from "@/lib/utils";

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

  if (!nextSignal) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="h-5 w-5 text-slate-400" />
            <span className="text-sm text-slate-500 uppercase tracking-wider">Próximo Sinal</span>
          </div>
          <p className="text-slate-400 text-sm">Nenhum sinal agendado</p>
        </CardContent>
      </Card>
    );
  }

  const { schedule, audio_file, folder } = nextSignal;

  return (
    <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 text-white">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <Bell className="h-5 w-5 text-blue-200" />
          <span className="text-sm text-blue-200 uppercase tracking-wider">Próximo Sinal</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold">{schedule.name || schedule.time}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="h-4 w-4 text-blue-200" />
              <span className="text-2xl font-mono font-semibold">{schedule.time}</span>
            </div>

            <div className="flex flex-wrap gap-1 mt-2">
              {schedule.days_of_week.map((d) => (
                <Badge key={d} variant="secondary" className="bg-blue-500/50 text-blue-100 border-0 text-xs">
                  {DAY_NAMES[d]}
                </Badge>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2 text-sm text-blue-200">
              {audio_file ? (
                <>
                  <Music className="h-4 w-4" />
                  <span>{audio_file.name}</span>
                </>
              ) : folder ? (
                <>
                  <Folder className="h-4 w-4" />
                  <span>{folder.name}</span>
                </>
              ) : null}
            </div>
            <div className="text-xs text-blue-300 mt-1">
              Duração: {formatSecondsToDisplay(schedule.play_duration_s)}
            </div>
          </div>

          <div className="text-right ml-4">
            <div className="text-xs text-blue-200 mb-1">Em</div>
            <div className="text-3xl font-mono font-bold">{formatCountdown(countdown)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
