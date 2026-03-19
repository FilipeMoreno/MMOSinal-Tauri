import { useEffect, useState } from "react";
import { Play, Square, Zap, Volume2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAudioStore } from "@/stores/audioStore";
import { usePlayerStore } from "@/stores/playerStore";
import { playerService } from "@/services/playerService";
import { formatDuration } from "@/lib/utils";
import { toast } from "sonner";

export function ManualSignalPanel() {
  const { folders, files, fetchFolders, fetchFiles } = useAudioStore();
  const { status, current_file, current_schedule, position_ms, volume } = usePlayerStore();

  const [folderId, setFolderId] = useState<number | null>(null);
  const [fileId, setFileId] = useState<number | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const isManualPlaying = status !== "idle" && current_schedule === null;
  const duration = current_file?.duration_ms ?? 0;
  const displayPos = dragValue ?? position_ms;
  const pct = duration > 0 ? (displayPos / duration) * 100 : 0;

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const handleFolderChange = (value: string) => {
    const id = Number(value);
    setFolderId(id);
    setFileId(null);
    fetchFiles(id);
  };

  const handlePlay = async () => {
    if (!fileId) return;
    setTriggering(true);
    try { await playerService.playManual(fileId); }
    catch (e) { toast.error(`Erro ao tocar: ${e}`); }
    finally { setTriggering(false); }
  };

  const handleStop = async () => {
    try { await playerService.stop(); }
    catch (e) { toast.error(`Erro ao parar: ${e}`); }
  };

  const handleSeek = async (ms: number) => {
    try { await playerService.seekPlayer(ms); }
    catch (e) { toast.error(`Erro ao buscar: ${e}`); }
  };

  const folderFiles = folderId ? (files[folderId] ?? []) : [];

  return (
    <Card className={isManualPlaying ? "border-l-4 border-l-blue-500 shadow-sm" : ""}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isManualPlaying && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
            <Zap className={`h-4 w-4 ${isManualPlaying ? "text-blue-500" : "text-slate-400"}`} />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Sinal Manual</span>
          </div>
          {isManualPlaying && (
            <span className="text-xs font-semibold text-blue-700 bg-blue-100 rounded-full px-2.5 py-0.5">
              Tocando
            </span>
          )}
        </div>

        {/* Now playing */}
        {isManualPlaying && current_file && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 space-y-2.5">
            <p className="font-semibold text-sm text-blue-900 truncate">{current_file.name}</p>

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
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:shadow
                [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0"
              style={{ background: `linear-gradient(to right, #3b82f6 ${pct}%, #dbeafe ${pct}%)` }}
            />

            <div className="flex items-center justify-between text-xs text-blue-600">
              <div className="flex items-center gap-1">
                <Volume2 className="h-3 w-3" />
                <span>{Math.round(volume * 100)}%</span>
              </div>
              <span className="font-mono tabular-nums">
                {formatDuration(displayPos)}{duration > 0 && ` / ${formatDuration(duration)}`}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
              Parar
            </Button>
          </div>
        )}

        {/* Selectors */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Pasta</label>
            <Select value={folderId?.toString() ?? ""} onValueChange={handleFolderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma pasta..." />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {folderId && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Arquivo</label>
              <Select value={fileId?.toString() ?? ""} onValueChange={(v) => setFileId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um arquivo..." />
                </SelectTrigger>
                <SelectContent>
                  {folderFiles.map((f) => (
                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handlePlay}
          disabled={!fileId || triggering}
        >
          <Play className="h-4 w-4 mr-2 fill-current" />
          {triggering ? "Iniciando..." : "Acionar Sinal"}
        </Button>
      </CardContent>
    </Card>
  );
}
