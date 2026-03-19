import { useState } from "react";
import { Music2, Square, Volume2, Radio } from "lucide-react";
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

  const handleSeek = async (ms: number) => {
    try { await playerService.seekPlayer(ms); }
    catch (e) { toast.error(`Erro ao buscar: ${e}`); }
  };

  if (!isActive) {
    return (
      <Card className="border-dashed border-2 border-slate-200 bg-slate-50">
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[172px] text-center gap-2">
          <div className="h-11 w-11 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <Radio className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Sinal Agendado</p>
          <p className="text-xs text-slate-400">Nenhum sinal tocando no momento</p>
        </CardContent>
      </Card>
    );
  }

  const statusLabel = STATUS_LABEL[status] ?? "Tocando";
  const scheduleName = current_schedule?.name?.trim() || current_schedule?.time || "";

  return (
    <Card className="border-l-4 border-l-green-500 shadow-sm">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Sinal Agendado</span>
          </div>
          <span className="text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2.5 py-0.5">
            {statusLabel}
          </span>
        </div>

        {/* File info */}
        <div className="mb-4">
          <p className="font-semibold text-slate-800 truncate">{current_file?.name}</p>
          {scheduleName && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{scheduleName}</p>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 100}
            value={displayPos}
            onChange={(e) => setDragValue(Number(e.target.value))}
            onMouseUp={(e) => { handleSeek(Number((e.target as HTMLInputElement).value)); setDragValue(null); }}
            onTouchEnd={(e) => { handleSeek(Number((e.target as HTMLInputElement).value)); setDragValue(null); }}
            disabled={duration === 0}
            className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer disabled:cursor-default
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow
              [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-green-500 [&::-moz-range-thumb]:border-0"
            style={{ background: `linear-gradient(to right, #22c55e ${pct}%, #e2e8f0 ${pct}%)` }}
          />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5" />
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <span className="font-mono tabular-nums">
              {formatDuration(displayPos)}{duration > 0 && ` / ${formatDuration(duration)}`}
            </span>
          </div>
        </div>

        {/* Stop */}
        <Button variant="outline" size="sm" className="mt-4 w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" onClick={handleStop}>
          <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
          Parar
        </Button>
      </CardContent>
    </Card>
  );
}
