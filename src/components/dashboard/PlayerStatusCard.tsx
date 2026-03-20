import { useState } from "react";
import { Music2, Square, Radio, SkipBack, SkipForward } from "lucide-react";
import { VolumeControl } from "@/components/shared/VolumeControl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/stores/playerStore";
import { playerService } from "@/services/playerService";
import { formatDuration } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  playing: "Tocando",
  fading_in: "Iniciando",
  fading_out: "Encerrando",
  paused: "Pausado",
  idle: "Parado",
};

export function PlayerStatusCard() {
  const { status, current_file, current_schedule, position_ms, volume } = usePlayerStore();
  const [dragValue, setDragValue] = useState<number | null>(null);

  const isActive = status !== "idle" && current_schedule !== null;
  const duration = current_file?.duration_ms ?? 0;
  const displayPos = dragValue ?? position_ms;
  const pct = duration > 0 ? (displayPos / duration) * 100 : 0;

  const handleStop = async () => {
    try { await playerService.stop(); }
    catch (e) { toast.error(`Erro ao parar: ${e}`); }
  };

  const handleSkip = async (dir: 1 | -1) => {
    try { await playerService.skipTrack(dir); }
    catch (e) { toast.error(`Erro ao trocar música: ${e}`); }
  };

  const handleSeek = async (ms: number) => {
    try { await playerService.seekPlayer(ms); }
    catch (e) { toast.error(`Erro ao buscar: ${e}`); }
  };

  if (!isActive) {
    return (
      <Card className="border-dashed border-2 border-slate-200 bg-slate-50 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-transparent opacity-50 pointer-events-none" />
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[172px] text-center gap-3 relative z-10 transition-transform group-hover:scale-[1.02] duration-300 ease-out">
          <div className="h-12 w-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
            <Radio className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Sinal Agendado</p>
            <p className="text-xs text-slate-400 mt-0.5">Nenhum sinal tocando no momento</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusLabel = STATUS_LABEL[status] ?? "Tocando";
  const scheduleName = current_schedule?.name?.trim() || current_schedule?.time || "";

  return (
    <Card className="relative overflow-hidden text-white transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border bg-gradient-to-br from-emerald-500 via-teal-500 to-teal-600 border-emerald-400/50 shadow-lg shadow-emerald-500/20">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-white opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl pointer-events-none" />

      <CardContent className="p-5 relative z-10 h-full flex flex-col justify-between min-h-[172px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            </span>
            <span className="text-xs text-emerald-100 uppercase tracking-widest font-bold">Sinal Agendado</span>
          </div>
          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider bg-white rounded-full px-2 py-0.5 shadow-sm">
            {statusLabel}
          </span>
        </div>

        {/* File info */}
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md shadow-inner border border-white/20 flex items-center justify-center flex-shrink-0">
              <Music2 className="h-5 w-5 text-white drop-shadow-sm" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-lg text-white truncate drop-shadow-sm leading-tight">{current_file?.name}</p>
              {scheduleName && (
                <p className="text-xs text-emerald-100 mt-1 truncate font-medium bg-black/10 inline-block px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10">{scheduleName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2 mt-auto">
          <div className="relative h-2 w-full bg-black/20 rounded-full overflow-hidden backdrop-blur-sm shadow-inner cursor-pointer" 
            onClick={(e) => {
              if (duration === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const p = (e.clientX - rect.left) / rect.width;
              handleSeek(Math.round(p * duration));
            }}>
            <div className="absolute top-0 left-0 h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-emerald-100 font-medium">
            <VolumeControl volume={volume} dark />
            <span className="font-mono tabular-nums bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-sm drop-shadow-sm">
              {formatDuration(displayPos)}{duration > 0 && ` / ${formatDuration(duration)}`}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" size="sm" className="text-white bg-white/10 hover:bg-white/20 hover:text-white border border-white/20 backdrop-blur-md shadow-sm transition-all px-3" onClick={() => handleSkip(-1)} title="Música anterior">
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-white bg-white/10 hover:bg-white/20 hover:text-white border border-white/20 backdrop-blur-md shadow-sm transition-all" onClick={handleStop}>
            <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
            Parar
          </Button>
          <Button variant="ghost" size="sm" className="text-white bg-white/10 hover:bg-white/20 hover:text-white border border-white/20 backdrop-blur-md shadow-sm transition-all px-3" onClick={() => handleSkip(1)} title="Próxima música">
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
