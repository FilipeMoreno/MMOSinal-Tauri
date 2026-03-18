import { useState } from "react";
import { Music2, Square, Volume2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlayerStore } from "@/stores/playerStore";
import { playerService } from "@/services/playerService";
import { formatDuration } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  idle: { label: "Parado", color: "secondary" },
  playing: { label: "Tocando", color: "success" },
  paused: { label: "Pausado", color: "warning" },
  fading_in: { label: "Fade In", color: "default" },
  fading_out: { label: "Fade Out", color: "default" },
};

export function PlayerStatusCard() {
  const { status, current_file, current_schedule, position_ms, volume } = usePlayerStore();

  // Only show scheduled playback here; manual playback is shown in ManualSignalPanel.
  const isScheduled = current_schedule !== null;
  const isActive = status !== "idle" && isScheduled;

  const handleStop = async () => {
    try {
      await playerService.stop();
    } catch (e) {
      toast.error(`Erro ao parar: ${e}`);
    }
  };

  const handleSeek = async (ms: number) => {
    try {
      await playerService.seekPlayer(ms);
    } catch (e) {
      toast.error(`Erro ao buscar: ${e}`);
    }
  };

  // Local drag value — only send seek on mouse/touch release to avoid rapid-fire play() calls
  const [dragValue, setDragValue] = useState<number | null>(null);

  const info = STATUS_LABEL[status] ?? STATUS_LABEL.idle;
  const duration = current_file?.duration_ms ?? 0;
  const displayPos = dragValue ?? position_ms;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <Music2 className="h-5 w-5 text-slate-400" />
          <span className="text-sm text-slate-500 uppercase tracking-wider">Sinal Agendado</span>
          {isActive && <Badge variant={info.color as any}>{info.label}</Badge>}
        </div>

        {isActive && current_file ? (
          <div>
            <p className="font-semibold text-lg truncate">{current_file.name}</p>
            {current_schedule && (current_schedule.name || current_schedule.time) && (
              <p className="text-xs text-slate-400 mb-1">{current_schedule.name || current_schedule.time}</p>
            )}
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
              <Volume2 className="h-4 w-4" />
              <span>{Math.round(volume * 100)}%</span>
              <span>•</span>
              <span>{formatDuration(position_ms)}</span>
              {duration > 0 && <span>/ {formatDuration(duration)}</span>}
            </div>
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              value={displayPos}
              onChange={(e) => setDragValue(Number(e.target.value))}
              onMouseUp={(e) => { handleSeek(Number((e.target as HTMLInputElement).value)); setDragValue(null); }}
              onTouchEnd={(e) => { handleSeek(Number((e.target as HTMLInputElement).value)); setDragValue(null); }}
              className="w-full mt-3 accent-blue-500 cursor-pointer"
              disabled={duration === 0}
            />
            <Button variant="outline" size="sm" className="mt-3" onClick={handleStop}>
              <Square className="h-4 w-4 mr-1" />
              Parar
            </Button>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Nenhum sinal agendado tocando</p>
        )}
      </CardContent>
    </Card>
  );
}
