import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play, Square, Zap, Music, Folder, FolderOpen, Search,
  Plus, X, ListMusic, RefreshCw, GripVertical, SkipBack, SkipForward, Pause,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAudioStore } from "@/stores/audioStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useUiStore } from "@/stores/uiStore";
import { playerService } from "@/services/playerService";
import { VolumeControl } from "@/components/shared/VolumeControl";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AudioFile } from "@/types";

// ── Sortable queue item (shared by dialog and card) ───────────────────────────

function SortableQueueItem({
  file,
  idx,
  isActive,
  onRemove,
  onClick,
  compact = false,
  dark = false,
}: {
  file: AudioFile;
  idx: number;
  isActive?: boolean;
  onRemove: () => void;
  onClick?: () => void;
  compact?: boolean;
  dark?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded transition-colors",
        compact ? "px-1.5 py-0.5" : "px-2 py-1",
        dark
          ? "text-blue-100 hover:bg-white/10"
          : isActive
            ? "bg-blue-100 text-blue-700"
            : "hover:bg-slate-100 text-slate-700",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "flex-shrink-0 cursor-grab active:cursor-grabbing touch-none",
          dark ? "text-white/30 hover:text-white/70" : "text-slate-300 hover:text-slate-500",
        )}
        tabIndex={-1}
      >
        <GripVertical className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
      <span className={cn(
        "font-mono flex-shrink-0 text-right",
        compact ? "text-[10px] w-3" : "text-xs w-4",
        dark ? "text-white/40" : "text-slate-400",
      )}>
        {idx + 1}
      </span>
      <button
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "truncate flex-1 min-w-0 text-left",
          compact ? "text-[11px]" : "text-xs",
          onClick ? "hover:opacity-80 cursor-pointer" : "cursor-default",
        )}
      >
        {file.name}
      </button>
      {!compact && file.duration_ms && (
        <span className={cn("text-[10px] font-mono flex-shrink-0", dark ? "text-white/40" : "text-slate-400")}>
          {formatDuration(file.duration_ms)}
        </span>
      )}
      <button
        onClick={onRemove}
        className={cn(
          "flex-shrink-0 h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
          dark ? "text-white/50 hover:text-red-300" : "text-slate-300 hover:text-red-500",
        )}
        title="Remover"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

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

  const isAddMode = hasActiveQueue && !newQueueMode;
  // isAddMode → show running remaining; otherwise → show local queue being built
  const displayQueue = isAddMode ? runningQueueRemaining : localQueue;

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
      // Fetch all folders so counts show immediately in the sidebar
      folders.forEach((f) => { if (!files[f.id]) fetchFiles(f.id); });
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

  const removeQueueItem = (fileId: number) => {
    if (isAddMode) {
      onReplaceRemainingQueue(runningQueueRemaining.filter((f) => f.id !== fileId));
    } else {
      handleRemoveLocal(fileId);
    }
  };

  const handleQueueAction = async () => {
    if (displayQueue.length === 0) return;
    const snapshot = [...displayQueue];
    onClose();
    await onPlayQueue(snapshot);
  };

  const dialogSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDialogDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = displayQueue.findIndex((f) => f.id === active.id);
    const newIdx = displayQueue.findIndex((f) => f.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(displayQueue, oldIdx, newIdx);
    if (isAddMode) {
      onReplaceRemainingQueue(reordered);
    } else {
      setLocalQueue(reordered);
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
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

        <div className="flex h-[420px] mt-4 border-t border-slate-100">
          {/* Folder sidebar */}
          <div className="w-40 flex-shrink-0 border-r border-slate-100 bg-slate-50 overflow-y-auto py-1">
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
          <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-100">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar arquivo..."
                  className="pl-8 h-8 text-sm bg-slate-50 border-slate-200"
                />
              </div>
              {folderFiles.length > 0 && (
                <button
                  onClick={async () => {
                    if (folderFiles.length === 0) return;
                    if (isAddMode) {
                      // Append folder files not already in running queue
                      const existingIds = new Set(runningQueueRemaining.map((f) => f.id));
                      folderFiles
                        .filter((f) => !existingIds.has(f.id))
                        .forEach((f) => onAppendToCurrentQueue(f));
                    } else if (newQueueMode) {
                      // Add all to local queue being built (deduplicated)
                      setLocalQueue((prev) => {
                        const ids = new Set(prev.map((f) => f.id));
                        return [...prev, ...folderFiles.filter((f) => !ids.has(f.id))];
                      });
                    } else {
                      // No active queue: play immediately
                      const snapshot = [...folderFiles];
                      onClose();
                      await onPlayQueue(snapshot);
                    }
                  }}
                  title={
                    isAddMode
                      ? "Adicionar pasta à fila atual"
                      : newQueueMode
                        ? "Adicionar pasta à nova fila"
                        : "Tocar pasta inteira como fila"
                  }
                  className="flex-shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  <Play className="h-3 w-3 fill-current" />
                  {isAddMode ? "+ Pasta" : newQueueMode ? "+ Pasta" : "Tocar pasta"}
                </button>
              )}
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

          {/* Queue sidebar (right) */}
          <div className="w-52 flex-shrink-0 flex flex-col bg-slate-50/40">
            {/* Sidebar header */}
            <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <ListMusic className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">
                  {isAddMode ? "Fila ativa" : "Lista de reprodução"}
                </span>
                {isAddMode && (
                  <span className="text-[10px] text-blue-500 bg-blue-50 rounded px-1.5 py-0.5 font-medium">
                    ao vivo
                  </span>
                )}
              </div>
              {!isAddMode && displayQueue.length > 0 && (
                <button
                  onClick={() => setLocalQueue([])}
                  className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                  title="Limpar lista"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Queue items */}
            <div className="flex-1 overflow-y-auto py-1">
              {displayQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2 px-4 text-center">
                  <ListMusic className="h-7 w-7" />
                  <p className="text-xs text-slate-400">Lista vazia</p>
                  <p className="text-[10px] text-slate-300">
                    {isAddMode ? "Adicione arquivos à fila" : "Use + para adicionar músicas"}
                  </p>
                </div>
              ) : (
                <DndContext sensors={dialogSensors} collisionDetection={closestCenter} onDragEnd={handleDialogDragEnd}>
                  <SortableContext items={displayQueue.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                    {displayQueue.map((file, idx) => (
                      <SortableQueueItem
                        key={file.id}
                        file={file}
                        idx={idx}
                        onRemove={() => removeQueueItem(file.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Sidebar footer */}
            <div className="border-t border-slate-100 px-3 py-2.5 flex-shrink-0 space-y-2">
              <div className="text-[10px] text-slate-400">
                {displayQueue.length} {displayQueue.length === 1 ? "música" : "músicas"}
                {queueDuration > 0 && <span> · {formatDuration(queueDuration)}</span>}
              </div>
              {!isAddMode && (
                <Button
                  size="sm"
                  className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleQueueAction}
                  disabled={displayQueue.length === 0}
                >
                  <Play className="h-3 w-3 mr-1.5 fill-current" />
                  {newQueueMode ? "Iniciar nova fila" : "Tocar fila"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ManualSignalPanel() {
  const { status, current_file, current_schedule, position_ms, volume } =
    usePlayerStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const manualSignalTrigger = useUiStore((s) => s.manualSignalTrigger);
  // Track the last-seen trigger so we only open on *new* increments, not on mount
  const prevTriggerRef = useRef(manualSignalTrigger);

  useEffect(() => {
    if (manualSignalTrigger > prevTriggerRef.current) {
      prevTriggerRef.current = manualSignalTrigger;
      if (!(status !== "idle" && current_schedule !== null)) {
        setPickerOpen(true);
      }
    }
  }, [manualSignalTrigger]); // intentionally omit status/current_schedule
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

const handleRemoveFromQueue = useCallback((fileId: number) => {
    const next = queueRef.current.filter((f) => f.id !== fileId);
    queueRef.current = next;
    if (next.length === 0) {
      inQueueModeRef.current = false;
      queueIdxRef.current = -1;
      setDisplayQueue([]);
      setQueueIdx(-1);
    } else {
      setDisplayQueue([...next]);
    }
  }, []);

  const handlePause = async () => {
    try { await playerService.pause(); }
    catch (e) { toast.error(`Erro: ${e}`); }
  };

  const handleSkipInQueue = useCallback(async (dir: 1 | -1) => {
    if (inQueueModeRef.current) {
      const next = queueIdxRef.current + dir;
      if (next >= 0 && next < queueRef.current.length) {
        await handleJumpToQueueItem(next);
      }
    } else {
      try { await playerService.skipTrack(dir); }
      catch (e) { toast.error(`Erro: ${e}`); }
    }
  }, [handleJumpToQueueItem]);

  const cardSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleCardDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const upcomingItems = queueRef.current.slice(queueIdxRef.current + 1);
    const oldIdx = upcomingItems.findIndex((f) => f.id === active.id);
    const newIdx = upcomingItems.findIndex((f) => f.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(upcomingItems, oldIdx, newIdx);
    const next = [...queueRef.current.slice(0, queueIdxRef.current + 1), ...reordered];
    queueRef.current = next;
    setDisplayQueue([...next]);
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
        "transition-all duration-300 relative overflow-hidden border",
        isManualPlaying 
          ? "bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-600 border-cyan-400/50 shadow-lg shadow-blue-500/20 text-white hover:shadow-xl hover:-translate-y-1"
          : isScheduledPlaying 
            ? "border-dashed border-2 border-indigo-200 bg-slate-50 opacity-90" 
            : "border-slate-200 bg-white shadow-sm"
      )}>
        {isManualPlaying && (
          <>
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-white opacity-10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl pointer-events-none" />
          </>
        )}

        <CardContent className="p-5 space-y-4 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isManualPlaying && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] absolute inline-flex h-full w-full rounded-full bg-cyan-200 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                </span>
              )}
              <Zap className={cn("h-4 w-4", isManualPlaying ? "text-cyan-100" : "text-slate-400")} />
              <span className={cn(
                "text-xs uppercase tracking-widest font-medium",
                isManualPlaying ? "text-cyan-100 font-bold" : "text-slate-500"
              )}>
                Sinal Manual
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {inQueueMode && (
                <span className={cn(
                  "text-[10px] rounded-full px-2 py-0.5 font-bold uppercase tracking-wider shadow-sm",
                  isManualPlaying ? "bg-white/20 text-white backdrop-blur-md border border-white/20" : "text-blue-600 bg-blue-50"
                )}>
                  Fila {queueIdx + 1}/{displayQueue.length}
                </span>
              )}
              {isManualPlaying && !inQueueMode && (
                <span className="text-[10px] font-bold text-blue-700 bg-white rounded-full px-2.5 py-0.5 shadow-sm uppercase tracking-wider">
                  Tocando
                </span>
              )}
              {isScheduledPlaying && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 rounded-full px-2.5 py-0.5 uppercase tracking-wider">
                  Agendamento ativo
                </span>
              )}
            </div>
          </div>

          {/* Now playing */}
          {isManualPlaying && current_file && (
            <div className="rounded-xl border p-3.5 space-y-3 bg-white/10 border-white/20 backdrop-blur-md shadow-inner">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Music className="h-4 w-4 text-white drop-shadow-sm" />
                </div>
                <p className="font-bold text-sm truncate flex-1 text-white drop-shadow-sm leading-tight">
                  {current_file.name}
                </p>
              </div>

              <div className="relative h-1.5 w-full bg-black/20 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  if (duration === 0) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const p = (e.clientX - rect.left) / rect.width;
                  handleSeek(p * duration);
                }}>
                <div className="absolute top-0 left-0 h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
              </div>

              <div className="flex items-center justify-between text-xs text-blue-100 font-medium pt-1">
                <VolumeControl volume={volume} dark />
                <span className="font-mono tabular-nums bg-black/10 px-2 py-0.5 rounded backdrop-blur-sm border border-white/5">
                  {formatDuration(displayPos)}
                  {duration > 0 && ` / ${formatDuration(duration)}`}
                </span>
              </div>
            </div>
          )}

          {/* Queue progress */}
          {inQueueMode && displayQueue.length > 1 && (
            <div className={cn(
              "rounded-xl border px-3 py-2.5 shadow-inner",
              isManualPlaying ? "bg-black/10 border-white/10 backdrop-blur-md" : "bg-slate-50 border-slate-100"
            )}>
              <div className="flex items-center gap-1.5 mb-2">
                <ListMusic className={cn("h-3.5 w-3.5", isManualPlaying ? "text-cyan-200" : "text-slate-400")} />
                <span className={cn("text-xs font-semibold uppercase tracking-wider", isManualPlaying ? "text-cyan-100" : "text-slate-500")}>
                  Fila de reprodução
                </span>
              </div>
              <div className="max-h-[120px] overflow-y-auto custom-scrollbar">
                {/* Played/current items (not sortable) */}
                {displayQueue.slice(0, queueIdx + 1).map((f, i) => (
                  <div
                    key={`played-${f.id}-${i}`}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] rounded px-1.5 py-0.5 font-medium",
                      i === queueIdx && isManualPlaying && "bg-white/20 text-white border border-white/20 shadow-sm",
                      i === queueIdx && !isManualPlaying && "bg-blue-100 text-blue-700",
                      i < queueIdx && isManualPlaying && "text-blue-200/40 line-through",
                      i < queueIdx && !isManualPlaying && "text-slate-400 line-through",
                    )}
                  >
                    <span className="font-mono w-3 text-right flex-shrink-0 opacity-70">{i + 1}</span>
                    {i === queueIdx
                      ? <Play className="h-2.5 w-2.5 flex-shrink-0 fill-current opacity-90" />
                      : <span className="w-2.5 flex-shrink-0" />
                    }
                    <button
                      onClick={() => i !== queueIdx && handleJumpToQueueItem(i)}
                      disabled={i === queueIdx}
                      className="truncate flex-1 text-left disabled:cursor-default hover:opacity-80"
                    >{f.name}</button>
                  </div>
                ))}
                {/* Upcoming items (sortable via DnD) */}
                {runningQueueRemaining.length > 0 && (
                  <DndContext sensors={cardSensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
                    <SortableContext items={runningQueueRemaining.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                      {runningQueueRemaining.map((f, relIdx) => {
                        const absIdx = queueIdx + 1 + relIdx;
                        return (
                          <SortableQueueItem
                            key={f.id}
                            file={f}
                            idx={absIdx}
                            compact
                            dark={isManualPlaying}
                            onClick={() => handleJumpToQueueItem(absIdx)}
                            onRemove={() => handleRemoveFromQueue(f.id)}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {isManualPlaying ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => handleSkipInQueue(-1)}
                  className="bg-white/10 text-white hover:bg-white/20 hover:text-white border border-white/20 transition-all px-2.5 shadow-sm"
                  title="Música anterior"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handlePause}
                  className="bg-white/10 text-white hover:bg-white/20 hover:text-white border border-white/20 transition-all px-2.5 shadow-sm"
                  title={status === "paused" ? "Retomar" : "Pausar"}
                >
                  {status === "paused"
                    ? <Play className="h-3.5 w-3.5 fill-current" />
                    : <Pause className="h-3.5 w-3.5 fill-current" />
                  }
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleStop}
                  className="bg-white/10 text-white hover:bg-white/20 hover:text-white border border-white/20 transition-all px-2.5 shadow-sm"
                  title="Parar"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleSkipInQueue(1)}
                  className="bg-white/10 text-white hover:bg-white/20 hover:text-white border border-white/20 transition-all px-2.5 shadow-sm"
                  title="Próxima música"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </Button>
                <Button
                  className="flex-1 bg-white text-blue-600 hover:bg-blue-50 border border-transparent font-semibold shadow-sm transition-all"
                  onClick={() => setPickerOpen(true)}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Trocar / Fila
                </Button>
              </>
            ) : (
              <Button
                className={cn(
                  "flex-1 font-semibold shadow-sm transition-all",
                  isScheduledPlaying
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-400"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                )}
                onClick={() => setPickerOpen(true)}
                disabled={isScheduledPlaying}
                title={isScheduledPlaying ? "Aguarde o agendamento terminar" : undefined}
              >
                <Zap className="h-4 w-4 mr-2" />
                Acionar Sinal
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
