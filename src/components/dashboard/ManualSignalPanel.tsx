import { useEffect, useState } from "react";
import { Play, Square, Music, Volume2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  // Manual playback = playing with no schedule
  const isManualPlaying = status !== "idle" && current_schedule === null;
  const duration = current_file?.duration_ms ?? 0;
  const displayPos = dragValue ?? position_ms;

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const handleFolderChange = (value: string) => {
    const id = Number(value);
    setFolderId(id);
    setFileId(null);
    fetchFiles(id);
  };

  const handlePlay = async () => {
    if (!fileId) return;
    setTriggering(true);
    try {
      await playerService.playManual(fileId);
    } catch (e) {
      toast.error(`Erro ao tocar: ${e}`);
    } finally {
      setTriggering(false);
    }
  };

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

  const folderFiles = folderId ? (files[folderId] ?? []) : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Music className="h-4 w-4 text-blue-500" />
            Sinal Manual
          </span>
          {isManualPlaying && (
            <Badge variant="success">Tocando</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Now playing */}
        {isManualPlaying && current_file && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-2">
            <p className="font-medium text-sm truncate text-blue-900">{current_file.name}</p>
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Volume2 className="h-3 w-3" />
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
              className="w-full accent-blue-500 cursor-pointer"
              disabled={duration === 0}
            />
            <Button variant="outline" size="sm" onClick={handleStop} className="w-full">
              <Square className="h-4 w-4 mr-1" />
              Parar
            </Button>
          </div>
        )}

        {/* Selector */}
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

        {folderId && (
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
        )}

        <Button
          className="w-full"
          onClick={handlePlay}
          disabled={!fileId || triggering}
        >
          <Play className="h-4 w-4 mr-2" />
          {triggering ? "Iniciando..." : "Acionar Sinal"}
        </Button>
      </CardContent>
    </Card>
  );
}
