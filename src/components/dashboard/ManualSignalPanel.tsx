import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play, Square, Zap, Volume2, Music, Folder, FolderOpen, Search,
  Plus, X, GripVertical, ListMusic, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAudioStore } from "@/stores/audioStore";
import { usePlayerStore } from "@/stores/playerStore";
import { playerService } from "@/services/playerService";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AudioFile } from "@/types";

// ── Picker Dialog ─────────────────────────────────────────────────────────────

interface PickerProps {
  open: boolean;
  onClose: () => void;
  /** Play a single file immediately, cancelling any running queue */
  onPlayNow: (file: AudioFile) => Promise<void>;
  /** Start a brand-new queue */
  onPlayQueue: (files: AudioFile[]) => Promise<void>;
  /** Append one file to the currently running queue (live) */
  onAppendToCurrentQueue: (file: AudioFile) => void;
  /** Replace remaining items in the running queue with a new list */
  onReplaceRemainingQueue: (files: AudioFile[]) => void;
  /** Remaining items from the running queue (after current track) */
  runningQueueRemaining: AudioFile[];
  /** Whether a queue is currently running */
  hasActiveQueue: boolean;
}

function ManualSignalPickerDialog({
  open,
  onClose,
  onPlayNow,
  onPlayQueue,
  onAppendToCurrentQueue,
  onReplaceRemainingQueue,
  runningQueueRemaining,
  hasActiveQueue,
}: PickerProps) {
  const { folders, files, fetchFolders, fetchFiles } = useAudioStore();
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  // localQueue is used in "new queue" mode
  const [localQueue, setLocalQueue] = useState<AudioFile[]>([]);
  // newQueueMode: true = building a replacement queue; false = adding to current queue
  const [newQueueMode, setNewQueueMode] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  // Shown queue depends on mode
  const displayQueue = newQueueMode ? localQueue : runningQueueRemaining;
  const isAddMode = hasActiveQueue && !newQueueMode;

  // Reset on each open
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setLocalQueue([]);
    setNewQueueMode(false);
    setLoadingId(null);
    fetchFolders();
  }, [open, fetchFolders]);

  useEffect(() => {
    if (open && folders.length > 0 && activeFolderId === null) {
      const id = folders[0].id;
      setActiveFolderId(id);
      if (!files[id]) fetchFiles(id);
    }
  }, [open, folders, activeFolderId, files, fetchFiles]);

  useEffect(() => {
    if (!open) setActiveFolderId(null);
  }, [open]);

  const handleSelectFolder = (id: number) => {
    setActiveFolderId(id);
    setSearch("");
    if (!files[id]) fetchFiles(id);
  };

  const handlePlayNow = async (file: AudioFile) => {
    setLoadingId(file.id);
    try {
      await onPlayNow(file);
      onClose();
    } catch {
      setLoadingId(null);
    }
  };

  const handleAdd = (file: AudioFile) => {
    if (isAddMode) {
      // Live-append to running queue
      onAppendToCurrentQueue(file);
    } else {
      // Build local queue
      setLocalQueue((prev) =>
        prev.some((f) => f.id === file.id) ? prev : [...prev, file],
      );
    }
  };

  const handleRemoveLocal = (fileId: number) => {
    setLocalQueue((prev) => prev.filter((f) => f.id !== fileId));
  };

  const moveLocalItem = (from: number, to: number) => {
    setLocalQueue((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleQueueAction = async () => {
    if (newQueueMode) {
      if (localQueue.length === 0) return;
      const snapshot = [...localQueue];
      onClose();
      await onPlayQueue(snapshot);
    } else {
      // Replace remaining with local queue (from "new queue" that was staged)
      onReplaceRemainingQueue(localQueue);
      onClose();
    }
  };

  const folderFiles = activeFolderId ? (files[activeFolderId] ?? []) : [];
  const filtered = search.trim()
    ? folderFiles.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : folderFiles;

  // Which file IDs are "in queue" — for highlight purposes
  const inQueueIds = new Set(
    isAddMode
      ? runningQueueRemaining.map((f) => f.id)
      : localQueue.map((f) => f.id),
  );

  const queueDuration = displayQueue.reduce((sum, f) => sum + (f.duration_ms ?? 0), 0);

  const queueBarVisible = isAddMode
    ? runningQueueRemaining.length > 0
    : localQueue.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-blue-500" />
                Acionar Sinal Manual
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAddMode
                  ? "Clique em + para adicionar à fila atual, ou em Tocar para substituir"
                  : "Clique em Tocar para acionar agora, ou em + para montar uma fila"}
              </p>
            </div>
            {hasActiveQueue && (
              <button
                onClick={() => {
                  setNewQueueMode((m) => !m);
                  setLocalQueue([]);
                }}
                className={cn(
                  "flex items-center gap-1.5 text-xs rounded-md px-2.5 py-1.5 border transition-colors flex-shrink-0 mt-0.5",
                  newQueueMode
                    ? "bg-blue-50 border-blue-200 text-blue-600"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700",
                )}
              >
                <RefreshCw className="h-3 w-3" />
                {newQueueMode ? "Cancelar nova fila" : "Nova fila"}
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="flex h-[390px] mt-4 border-t border-slate-100">
          {/* Folder sidebar */}
          <div className="w-44 flex-shrink-0 border-r border-slate-100 bg-slate-50 overflow-y-auto py-1">
            {folders.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8 px-3">Nenhuma pasta</p>
            ) : (
              folders.map((folder) => {
                const isActive = activeFolderId === folder.id;
                const count = files[folder.id]?.length;
                return (
                  <button
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors border-l-2",
                      isActive
                        ? "bg-blue-50 text-blue-700 border-l-blue-500 font-medium"
                        : "text-slate-600 hover:bg-white hover:text-slate-800 border-l-transparent",
                    )}
                  >
                    {isActive
                      ? <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                      : <Folder className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    }
                    <span className="flex-1 truncate">{folder.name}</span>
                    {count !== undefined && (
                      <span className="text-xs text-slate-400 tabular-nums">{count}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* File list */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar arquivo..."
                  className="pl-8 h-8 text-sm bg-slate-50 border-slate-200"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!activeFolderId ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Folder className="h-8 w-8 mb-2 text-slate-200" />
                  <p className="text-sm">Selecione uma pasta</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Music className="h-8 w-8 mb-2 text-slate-200" />
                  <p className="text-sm">{search ? "Nenhum resultado" : "Pasta vazia"}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filtered.map((file) => {
                    const inQueue = inQueueIds.has(file.id);
                    const isLoading = loadingId === file.id;
                    return (
                      <div
                        key={file.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 group transition-colors",
                          inQueue ? "bg-blue-50/60" : "hover:bg-slate-50",
                        )}
                      >
                        {/* Play now */}
                        <button
                          onClick={() => handlePlayNow(file)}
                          disabled={loadingId !== null}
                          className={cn(
                            "flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-colors",
                            isLoading ? "bg-blue-500" : "bg-slate-100 hover:bg-blue-500 disabled:opacity-40",
                          )}
                          title="Tocar agora"
                        >
                          {isLoading
                            ? <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                            : <Play className="h-3 w-3 text-slate-400 group-hover:text-slate-600 fill-current" />
                          }
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate text-slate-700">{file.name}</p>
                        </div>

                        {file.duration_ms && (
                          <span className="text-xs tabular-nums text-slate-400 font-mono flex-shrink-0">
                            {formatDuration(file.duration_ms)}
                          </span>
                        )}

                        {/* Add / already-in-queue indicator */}
                        {inQueue && isAddMode ? (
                          // In add-mode: show a subtle "in queue" badge, not removable here
                          <span className="flex-shrink-0 h-6 w-6 rounded flex items-center justify-center">
                            <ListMusic className="h-3 w-3 text-blue-400" />
                          </span>
                        ) : inQueue && !isAddMode ? (
                          <button
                            onClick={() => handleRemoveLocal(file.id)}
                            className="flex-shrink-0 h-6 w-6 rounded flex items-center justify-center text-blue-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Remover da fila"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAdd(file)}
                            className="flex-shrink-0 h-6 w-6 rounded flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                            title={isAddMode ? "Adicionar à fila" : "Adicionar à fila"}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Queue bar */}
        {queueBarVisible && (
          <div className="border-t border-slate-100">
            <div className="px-4 pt-3 pb-1 max-h-28 overflow-y-auto space-y-1">
              {displayQueue.map((file, idx) => (
                <div key={`${file.id}-${idx}`} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-xs font-mono text-slate-400 w-4 text-right flex-shrink-0">
                      {idx + 1}
                    </span>
                    {!isAddMode && (
                      <GripVertical className="h-3 w-3 text-slate-300 flex-shrink-0" />
                    )}
                    <p className="text-xs text-slate-600 truncate">{file.name}</p>
                    {file.duration_ms && (
                      <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                        {formatDuration(file.duration_ms)}
                      </span>
                    )}
                  </div>
                  {!isAddMode && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {idx > 0 && (
                        <button
                          onClick={() => moveLocalItem(idx, idx - 1)}
                          className="h-4 w-4 text-slate-300 hover:text-slate-500 text-xs leading-none"
                        >
                          ↑
                        </button>
                      )}
                      {idx < displayQueue.length - 1 && (
                        <button
                          onClick={() => moveLocalItem(idx, idx + 1)}
                          className="h-4 w-4 text-slate-300 hover:text-slate-500 text-xs leading-none"
                        >
                          ↓
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveLocal(file.id)}
                        className="h-4 w-4 text-slate-300 hover:text-red-400 ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <ListMusic className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">
                  {displayQueue.length} {displayQueue.length === 1 ? "música" : "músicas"}
                  {queueDuration > 0 && (
                    <span className="text-slate-400"> · {formatDuration(queueDuration)}</span>
                  )}
                </span>
                {isAddMode && (
                  <span className="text-xs text-blue-500 bg-blue-50 rounded px-1.5 py-0.5">
                    fila ativa
                  </span>
                )}
                {!isAddMode && (
                  <button
                    onClick={() => setLocalQueue([])}
                    className="text-xs text-slate-400 hover:text-red-500 underline underline-offset-2"
                  >
                    Limpar
                  </button>
                )}
              </div>
              {!isAddMode && (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleQueueAction}
                  disabled={localQueue.length === 0}
                >
                  <Play className="h-3 w-3 mr-1.5 fill-current" />
                  {newQueueMode ? "Iniciar nova fila" : "Tocar fila"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ManualSignalPanel() {
  const { status, current_file, current_schedule, position_ms, volume } =
    usePlayerStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const [displayQueue, setDisplayQueue] = useState<AudioFile[]>([]);
  const [queueIdx, setQueueIdx] = useState(-1);
  const queueRef = useRef<AudioFile[]>([]);
  const queueIdxRef = useRef(-1);
  const inQueueModeRef = useRef(false);
  const prevStatusRef = useRef(status);

  const isPlaying = status !== "idle";
  const isManualPlaying = isPlaying && current_schedule === null;
  const isScheduledPlaying = isPlaying && current_schedule !== null;
  const duration = current_file?.duration_ms ?? 0;
  const displayPos = dragValue ?? position_ms;
  const pct = duration > 0 ? (displayPos / duration) * 100 : 0;

  // Advance queue when a file ends naturally
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prev !== "idle" && status === "idle" && inQueueModeRef.current) {
      const nextIdx = queueIdxRef.current + 1;
      if (nextIdx < queueRef.current.length) {
        queueIdxRef.current = nextIdx;
        setQueueIdx(nextIdx);
        playerService.playManual(queueRef.current[nextIdx].id).catch(() => {});
      } else {
        inQueueModeRef.current = false;
        queueRef.current = [];
        queueIdxRef.current = -1;
        setDisplayQueue([]);
        setQueueIdx(-1);
      }
    }
  }, [status]);

  const handlePlayNow = useCallback(async (file: AudioFile) => {
    inQueueModeRef.current = false;
    queueRef.current = [];
    queueIdxRef.current = -1;
    setDisplayQueue([]);
    setQueueIdx(-1);
    await playerService.playManual(file.id);
  }, []);

  const handlePlayQueue = useCallback(async (files: AudioFile[]) => {
    if (files.length === 0) return;
    queueRef.current = files;
    queueIdxRef.current = 0;
    inQueueModeRef.current = true;
    setDisplayQueue(files);
    setQueueIdx(0);
    await playerService.playManual(files[0].id);
  }, []);

  // Append one file to the running queue (live, called from dialog "+" in add-mode)
  const handleAppendToCurrentQueue = useCallback((file: AudioFile) => {
    queueRef.current = [...queueRef.current, file];
    setDisplayQueue((prev) => [...prev, file]);
  }, []);

  // Replace remaining items (from queueIdx+1 onwards) with a new list
  const handleReplaceRemainingQueue = useCallback((files: AudioFile[]) => {
    const current = queueRef.current[queueIdxRef.current];
    const newQueue = current ? [current, ...files] : files;
    queueRef.current = newQueue;
    // queueIdxRef stays at 0 (pointing to current song which is now index 0)
    queueIdxRef.current = current ? 0 : 0;
    setDisplayQueue(newQueue);
    setQueueIdx(0);
    inQueueModeRef.current = newQueue.length > 0;
  }, []);

  const handleStop = async () => {
    inQueueModeRef.current = false;
    queueRef.current = [];
    queueIdxRef.current = -1;
    setDisplayQueue([]);
    setQueueIdx(-1);
    try { await playerService.stop(); }
    catch (e) { toast.error(`Erro ao parar: ${e}`); }
  };

  const handleSeek = async (ms: number) => {
    try { await playerService.seekPlayer(ms); }
    catch (e) { toast.error(`Erro: ${e}`); }
  };

  const handleJumpToQueueItem = useCallback(async (idx: number) => {
    if (idx < 0 || idx >= queueRef.current.length) return;
    queueIdxRef.current = idx;
    setQueueIdx(idx);
    await playerService.playManual(queueRef.current[idx].id).catch(() => {});
  }, []);

  const inQueueMode = displayQueue.length > 0 && queueIdx >= 0;
  const runningQueueRemaining = inQueueMode
    ? displayQueue.slice(queueIdx + 1)
    : [];

  return (
    <>
      <ManualSignalPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPlayNow={handlePlayNow}
        onPlayQueue={handlePlayQueue}
        onAppendToCurrentQueue={handleAppendToCurrentQueue}
        onReplaceRemainingQueue={handleReplaceRemainingQueue}
        runningQueueRemaining={runningQueueRemaining}
        hasActiveQueue={inQueueMode}
      />

      <Card className={cn(
        isManualPlaying && "border-l-4 border-l-blue-500 shadow-sm",
        isScheduledPlaying && "border-l-4 border-l-indigo-300",
      )}>
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
              <Zap className={cn("h-4 w-4", isManualPlaying ? "text-blue-500" : "text-slate-400")} />
              <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">
                Sinal Manual
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {inQueueMode && (
                <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 font-mono">
                  Fila {queueIdx + 1}/{displayQueue.length}
                </span>
              )}
              {isManualPlaying && !inQueueMode && (
                <span className="text-xs font-semibold text-blue-700 bg-blue-100 rounded-full px-2.5 py-0.5">
                  Tocando
                </span>
              )}
              {isScheduledPlaying && (
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-full px-2.5 py-0.5">
                  Agendamento ativo
                </span>
              )}
            </div>
          </div>

          {/* Now playing */}
          {isManualPlaying && current_file && (
            <div className={cn(
              "rounded-lg border p-3 space-y-2.5",
              isManualPlaying ? "bg-blue-50 border-blue-100" : "bg-slate-50 border-slate-100",
            )}>
              <div className="flex items-center gap-2 min-w-0">
                <Music className={cn("h-3.5 w-3.5 flex-shrink-0", isManualPlaying ? "text-blue-400" : "text-slate-400")} />
                <p className={cn(
                  "font-semibold text-sm truncate flex-1",
                  isManualPlaying ? "text-blue-900" : "text-slate-700",
                )}>
                  {current_file.name}
                </p>
              </div>

              <input
                type="range"
                min={0}
                max={duration > 0 ? duration : 100}
                value={displayPos}
                onChange={(e) => setDragValue(Number(e.target.value))}
                onMouseUp={(e) => { handleSeek(Number((e.target as HTMLInputElement).value)); setDragValue(null); }}
                onTouchEnd={(e) => { handleSeek(Number((e.target as HTMLInputElement).value)); setDragValue(null); }}
                disabled={duration === 0 || isScheduledPlaying}
                className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer disabled:cursor-default
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:shadow
                  [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0"
                style={{
                  background: `linear-gradient(to right, #3b82f6 ${pct}%, ${isManualPlaying ? "#dbeafe" : "#e2e8f0"} ${pct}%)`,
                }}
              />

              <div className="flex items-center justify-between text-xs text-blue-600">
                <div className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3" />
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <span className="font-mono tabular-nums">
                  {formatDuration(displayPos)}
                  {duration > 0 && ` / ${formatDuration(duration)}`}
                </span>
              </div>
            </div>
          )}

          {/* Queue progress */}
          {inQueueMode && displayQueue.length > 1 && (
            <div className="rounded-md bg-slate-50 border border-slate-100 px-3 py-2 space-y-0.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ListMusic className="h-3 w-3 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">Fila de reprodução</span>
              </div>
              {displayQueue.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => i !== queueIdx && handleJumpToQueueItem(i)}
                  disabled={i === queueIdx}
                  className={cn(
                    "w-full flex items-center gap-2 text-xs rounded px-1.5 py-0.5 text-left transition-colors",
                    i === queueIdx && "bg-blue-100 text-blue-700 font-medium cursor-default",
                    i < queueIdx && "text-slate-300 line-through hover:bg-slate-100 hover:text-slate-500 cursor-pointer",
                    i > queueIdx && "text-slate-500 hover:bg-blue-50 hover:text-blue-600 cursor-pointer",
                  )}
                >
                  <span className="font-mono w-3 text-right flex-shrink-0">{i + 1}</span>
                  {i === queueIdx
                    ? <Play className="h-2.5 w-2.5 flex-shrink-0 fill-current text-blue-500" />
                    : <span className="w-2.5 flex-shrink-0" />
                  }
                  <span className="truncate flex-1">{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className={cn(
                "flex-1",
                isScheduledPlaying
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  : "bg-blue-600 hover:bg-blue-700 text-white",
              )}
              onClick={() => setPickerOpen(true)}
              disabled={isScheduledPlaying}
              title={isScheduledPlaying ? "Aguarde o agendamento terminar" : undefined}
            >
              <Zap className="h-4 w-4 mr-2" />
              {isManualPlaying ? "Trocar / Fila" : "Acionar Sinal"}
            </Button>

            {isManualPlaying && (
              <Button
                variant="outline"
                onClick={handleStop}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 px-3"
                title="Parar"
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
