import { useEffect, useRef, useState } from "react";
import {
  Music, Trash2, RotateCcw, Upload, GripVertical, MoreVertical,
  Edit2, FolderInput, Check, X, Shuffle, ArrowDownUp, ScanLine, Loader2, Eye, EyeOff,
} from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAudioStore } from "@/stores/audioStore";
import { audioService } from "@/services/audioService";
import { changeLogService } from "@/services/changeLogService";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AudioFile, AudioFolder } from "@/types";

interface Props {
  draggingFileId: number | null;
  setDraggingFileId: (id: number | null) => void;
  setDraggingSourceFolderId: (id: number | null) => void;
  setDraggingTargetFolderId: (id: number | null) => void;
  onFileDropToFolder: (targetFolderId: number, fileId: number, sourceFolderId: number | null) => void;
  currentFolder: AudioFolder | null;
}

interface ContextMenu {
  fileId: number;
  x: number;
  y: number;
}

interface MovePickerState {
  fileId: number;
  anchorX: number;
  anchorY: number;
}

function msToS(ms: number): string {
  return (ms / 1000).toFixed(1) + "s";
}

function SilenceBadge({ file, compact = false }: { file: AudioFile; compact?: boolean }) {
  const scanningFileId = useAudioStore((s) => s.scanningFileId);
  const baseClass = compact
    ? "flex-shrink-0 h-5 w-5 rounded inline-flex items-center justify-center"
    : "flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium leading-none inline-flex items-center gap-1";

  if (scanningFileId === file.id) {
    return (
      <span
        className={cn(baseClass, "bg-blue-50 text-blue-500 border border-blue-200")}
        title="Analisando silêncio..."
      >
        <Loader2 className={cn("animate-spin", compact ? "h-3 w-3" : "h-2.5 w-2.5")} />
        {!compact && "Analisando..."}
      </span>
    );
  }

  // content_start_ms === null means file was never analyzed
  // content_start_ms === 0   means analyzed, no leading silence
  // content_start_ms > 0     means analyzed, has leading silence
  const isAnalyzed = file.content_start_ms !== null;
  const hasLeadingSilence = isAnalyzed && file.content_start_ms! > 0;
  const hasTrailingSilence = file.content_end_ms !== null;

  if (!isAnalyzed) {
    return (
      <span
        className={cn(baseClass, "bg-slate-100 text-slate-400")}
        title="Não analisado"
      >
        {compact ? <ScanLine className="h-3 w-3" /> : "Não analisado"}
      </span>
    );
  }

  if (!hasLeadingSilence && !hasTrailingSilence) {
    return (
      <span
        className={cn(baseClass, "bg-green-50 text-green-600 border border-green-200")}
        title="Sem silêncio detectado"
      >
        {compact ? <Check className="h-3 w-3" /> : "✓ Sem silêncio"}
      </span>
    );
  }

  const parts: string[] = [];
  if (hasLeadingSilence) parts.push(`+${msToS(file.content_start_ms!)}`);
  if (hasTrailingSilence && file.duration_ms) {
    const trailMs = file.duration_ms - file.content_end_ms!;
    if (trailMs > 0) parts.push(`-${msToS(trailMs)}`);
  }

  return (
    <span
      className={cn(baseClass, "bg-amber-50 text-amber-600 border border-amber-200")}
      title={`Silêncio — início: ${msToS(file.content_start_ms ?? 0)}, fim do conteúdo: ${file.content_end_ms != null ? msToS(file.content_end_ms) : "até o fim"}`}
    >
      {compact ? <ScanLine className="h-3 w-3" /> : `~silêncio${parts.length > 0 ? ` (${parts.join(", ")})` : ""}`}
    </span>
  );
}

export function AudioFileList({
  draggingFileId,
  setDraggingFileId,
  setDraggingSourceFolderId,
  setDraggingTargetFolderId,
  onFileDropToFolder,
  currentFolder,
}: Props) {
  const {
    selectedFolderId,
    folders,
    files,
    addFiles,
    removeFile,
    fetchFiles,
    setFiles,
    updateFile,
    moveFile: moveFileInStore,
    renameFileInStore,
    updateFolder,
    scanningFolderId,
    scanningFileId,
    setScanningFolder,
    setScanningFile,
  } = useAudioStore();
  const { confirm, dialog } = useConfirm();

  const folderId = selectedFolderId;
  const folderFiles = folderId ? (files[folderId] ?? []) : [];

  const isScanning = folderId !== null && scanningFolderId === folderId;

  // ── Drag-reorder state ───────────────────────────────────────────────────
  const dragIndexRef = useRef<number | null>(null);
  // insertBefore: the item at this index gets the line drawn ABOVE it (insert before it)
  const [insertBeforeIndex, setInsertBeforeIndex] = useState<number | null>(null);
  const pointerDragRef = useRef<{ fileId: number; sourceFolderId: number; fromIndex: number } | null>(null);
  const [pointerDragging, setPointerDragging] = useState(false);
  const fileListContainerRef = useRef<HTMLDivElement>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number; name: string } | null>(null);

  // ── Multi-select state ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Rename state ─────────────────────────────────────────────────────────
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── Context menu state ───────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  // ── Move picker state ────────────────────────────────────────────────────
  const [movePicker, setMovePicker] = useState<MovePickerState | null>(null);
  const [bulkMovePicker, setBulkMovePicker] = useState(false);
  const bulkMoveButtonRef = useRef<HTMLButtonElement>(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [showSilenceBadge, setShowSilenceBadge] = useState<boolean>(
    () => localStorage.getItem("audio-show-silence-badge") !== "false"
  );

  // Close context menu + move picker when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-context-menu]")) {
        setContextMenu(null);
      }
      if (!target.closest("[data-move-picker]") && !target.closest("[data-move-trigger]")) {
        setMovePicker(null);
        setBulkMovePicker(false);
      }
      if (!target.closest("[data-actions-menu]") && !target.closest("[data-actions-trigger]")) {
        setActionsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset selection when folder changes
  useEffect(() => {
    setSelectedIds(new Set());
    setRenamingId(null);
    setContextMenu(null);
    setMovePicker(null);
  }, [folderId]);

  useEffect(() => {
    if (folderId) fetchFiles(folderId);
  }, [folderId, fetchFiles]);

  useEffect(() => {
    localStorage.setItem("audio-show-silence-badge", String(showSilenceBadge));
  }, [showSilenceBadge]);

  // ── Silence scan (per-file, progressive) ─────────────────────────────────
  const handleScanSilence = async () => {
    if (!folderId || scanningFolderId !== null) return;
    const filesToScan = folderFiles;
    if (filesToScan.length === 0) return;

    setScanningFolder(folderId);
    changeLogService.log(
      "analyzed",
      "audio_file",
      currentFolder?.name ?? null,
      `Análise de silêncio iniciada: ${filesToScan.length} arquivo(s)`,
    );

    let withSilence = 0;
    for (const file of filesToScan) {
      setScanningFile(file.id);
      try {
        const updated = await audioService.analyzeFileSilence(file.id);
        updateFile(folderId, updated);
        if (updated.content_end_ms !== null || (updated.content_start_ms !== null && updated.content_start_ms > 0)) {
          withSilence++;
        }
      } catch {
        // continue on per-file error
      }
    }

    setScanningFolder(null);
    setScanningFile(null);

    changeLogService.log(
      "analyzed",
      "audio_file",
      currentFolder?.name ?? null,
      `Análise concluída: ${filesToScan.length} arquivo(s) — ${withSilence} com silêncio detectado`,
    );

    if (withSilence > 0) {
      toast.success(`${filesToScan.length} arquivo(s) analisado(s) — ${withSilence} com silêncio detectado`);
    } else {
      toast.success(`${filesToScan.length} arquivo(s) analisado(s) — nenhum silêncio significativo`);
    }
  };

  const handleAnalyzeSingle = async (file: AudioFile) => {
    if (!folderId || scanningFolderId !== null) return;
    setContextMenu(null);
    setScanningFile(file.id);
    try {
      const updated = await audioService.analyzeFileSilence(file.id);
      updateFile(folderId, updated);
      const hasSilence = updated.content_end_ms !== null || (updated.content_start_ms !== null && updated.content_start_ms > 0);
      toast.success(hasSilence ? "Análise concluída: silêncio detectado" : "Análise concluída: sem silêncio");
      changeLogService.log("analyzed", "audio_file", file.name, "Análise individual de silêncio");
    } catch (e) {
      toast.error(`Erro ao analisar: ${e}`);
    } finally {
      setScanningFile(null);
    }
  };

  // ── Shuffle toggle ───────────────────────────────────────────────────────
  const handleToggleShuffle = async () => {
    if (!currentFolder) return;
    try {
      const updated = await audioService.toggleShuffle(currentFolder.id, !currentFolder.shuffle);
      updateFolder(updated);
      toast.success(updated.shuffle ? "Modo aleatório ativado" : "Modo em ordem ativado");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  // ── Import ───────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!folderId) return;
    const selected = await open({
      multiple: true,
      filters: [{ name: "Áudio", extensions: ["mp3", "wav", "ogg", "flac", "aac", "m4a"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    try {
      const imported = await audioService.importFiles(folderId, paths);
      addFiles(folderId, imported);
      toast.success(`${imported.length} arquivo(s) importado(s)`);
      changeLogService.log("imported", "audio_file", null, `${imported.length} arquivo(s) para a pasta`);
    } catch (e) {
      toast.error(`Erro ao importar: ${e}`);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (fileId: number, fileName: string) => {
    if (!folderId) return;
    setContextMenu(null);
    if (!await confirm({ message: `Remover "${fileName}"?`, confirmLabel: "Remover" })) return;
    try {
      await audioService.deleteFile(fileId);
      removeFile(folderId, fileId);
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(fileId); return s; });
      toast.success("Arquivo removido");
      changeLogService.log("deleted", "audio_file", fileName);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  // ── Reset playback ───────────────────────────────────────────────────────
  const handleResetState = async (fileId: number) => {
    setContextMenu(null);
    try {
      await audioService.resetPlaybackState(fileId);
      toast.success("Posição de reprodução resetada");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  // ── Rename ───────────────────────────────────────────────────────────────
  const startRename = (file: AudioFile) => {
    setContextMenu(null);
    setRenamingId(file.id);
    setRenameValue(file.name);
  };

  const commitRename = async () => {
    if (!folderId || renamingId === null) return;
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    try {
      const oldName = folderFiles.find((f) => f.id === renamingId)?.name;
      await audioService.renameFile(renamingId, trimmed);
      renameFileInStore(folderId, renamingId, trimmed);
      toast.success("Arquivo renomeado");
      changeLogService.log("renamed", "audio_file", trimmed, oldName ? `Antes: ${oldName}` : null);
    } catch (e) {
      toast.error(`Erro ao renomear: ${e}`);
    } finally {
      setRenamingId(null);
    }
  };

  // ── Move single file ─────────────────────────────────────────────────────
  const handleMoveFile = async (fileId: number, sourceFolderId: number, targetFolderId: number) => {
    setMovePicker(null);
    setContextMenu(null);
    if (sourceFolderId === targetFolderId) return;
    try {
      const file = folderFiles.find((f) => f.id === fileId);
      const targetFolder = folders.find((f) => f.id === targetFolderId);
      const updated = await audioService.moveFile(fileId, targetFolderId);
      moveFileInStore(fileId, sourceFolderId, targetFolderId, updated);
      toast.success("Arquivo movido");
      changeLogService.log("moved", "audio_file", file?.name, `Para: ${targetFolder?.name ?? targetFolderId}`);
    } catch (e) {
      toast.error(`Erro ao mover: ${e}`);
    }
  };

  // ── Move multiple files ──────────────────────────────────────────────────
  const handleBulkMove = async (targetFolderId: number) => {
    if (!folderId) return;
    setBulkMovePicker(false);
    if (folderId === targetFolderId) return;
    const ids = Array.from(selectedIds);
    try {
      for (const fileId of ids) {
        const updated = await audioService.moveFile(fileId, targetFolderId);
        moveFileInStore(fileId, folderId, targetFolderId, updated);
      }
      setSelectedIds(new Set());
      toast.success(`${ids.length} arquivo(s) movido(s)`);
      const targetFolder = folders.find((f) => f.id === targetFolderId);
      changeLogService.log("moved", "audio_file", null, `${ids.length} arquivo(s) para: ${targetFolder?.name ?? targetFolderId}`);
    } catch (e) {
      toast.error(`Erro ao mover: ${e}`);
    }
  };

  // ── Delete multiple files ────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!folderId) return;
    const ids = Array.from(selectedIds);
    if (!await confirm({ message: `Remover ${ids.length} arquivo(s) selecionado(s)?`, confirmLabel: "Remover" })) return;
    try {
      for (const fileId of ids) {
        await audioService.deleteFile(fileId);
        removeFile(folderId, fileId);
      }
      setSelectedIds(new Set());
      toast.success(`${ids.length} arquivo(s) removido(s)`);
      changeLogService.log("deleted", "audio_file", null, `${ids.length} arquivo(s)`);
    } catch (e) {
      toast.error(`Erro ao excluir: ${e}`);
    }
  };

  // ── Reset playback for multiple files ────────────────────────────────────
  const handleBulkResetState = async () => {
    const ids = Array.from(selectedIds);
    try {
      for (const fileId of ids) {
        await audioService.resetPlaybackState(fileId);
      }
      setSelectedIds(new Set());
      toast.success(`Posição resetada para ${ids.length} arquivo(s)`);
    } catch (e) {
      toast.error(`Erro ao resetar: ${e}`);
    }
  };

  // ── Pointer-drag (stable in Tauri WebView) ───────────────────────────────
  const clearPointerDrag = () => {
    pointerDragRef.current = null;
    dragIndexRef.current = null;
    setInsertBeforeIndex(null);
    setDraggingFileId(null);
    setDraggingSourceFolderId(null);
    setDraggingTargetFolderId(null);
    setDragPreview(null);
    setPointerDragging(false);
  };

  const commitReorder = async (fromIndex: number, target: number) => {
    if (!folderId) return;
    // Normalize: inserting after fromIndex is same as inserting before fromIndex+1
    const effectiveTarget = target > fromIndex ? target - 1 : target;
    if (effectiveTarget === fromIndex) return;

    const newList = [...folderFiles];
    const [moved] = newList.splice(fromIndex, 1);
    newList.splice(effectiveTarget, 0, moved);
    setFiles(folderId, newList);

    try {
      await audioService.reorderFiles(folderId, newList.map((f) => f.id));
    } catch (e) {
      toast.error(`Erro ao reordenar: ${e}`);
      fetchFiles(folderId);
    }
  };

  const parseIndex = (value: string | undefined): number | null => {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const getFolderIdFromPoint = (x: number, y: number): number | null => {
    const target = document.elementFromPoint(x, y);
    if (!(target instanceof HTMLElement)) return null;
    const row = target.closest<HTMLElement>("[data-folder-id]");
    return parseIndex(row?.dataset.folderId);
  };

  const getInsertBeforeFromPoint = (x: number, y: number): number | null => {
    const target = document.elementFromPoint(x, y);
    if (!(target instanceof HTMLElement)) return null;

    const row = target.closest<HTMLElement>("[data-file-index]");
    if (row) {
      const idx = parseIndex(row.dataset.fileIndex);
      if (idx === null) return null;
      const rect = row.getBoundingClientRect();
      return y < rect.top + rect.height / 2 ? idx : idx + 1;
    }

    const listEl = fileListContainerRef.current;
    if (!listEl || !listEl.contains(target)) return null;

    const rows = Array.from(listEl.querySelectorAll<HTMLElement>("[data-file-index]"));
    if (rows.length === 0) return 0;
    const firstRect = rows[0].getBoundingClientRect();
    const lastRect = rows[rows.length - 1].getBoundingClientRect();
    if (y < firstRect.top) return 0;
    if (y > lastRect.bottom) return rows.length;
    return null;
  };

  const handlePointerDragStart = (e: React.PointerEvent, index: number, file: AudioFile) => {
    if (e.button !== 0 || folderId === null) return;
    e.preventDefault();
    e.stopPropagation();
    pointerDragRef.current = { fileId: file.id, sourceFolderId: folderId, fromIndex: index };
    dragIndexRef.current = index;
    setDraggingFileId(file.id);
    setDraggingSourceFolderId(folderId);
    setDraggingTargetFolderId(null);
    setDragPreview({ x: e.clientX, y: e.clientY, name: file.name });
    setInsertBeforeIndex(index);
    setPointerDragging(true);
  };

  useEffect(() => {
    if (!pointerDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const targetFolderId = getFolderIdFromPoint(e.clientX, e.clientY);
      setDraggingTargetFolderId(targetFolderId);
      setDragPreview((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));

      const insertBefore = getInsertBeforeFromPoint(e.clientX, e.clientY);
      if (insertBefore !== null) {
        setInsertBeforeIndex(insertBefore);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag) {
        clearPointerDrag();
        return;
      }

      const targetFolderId = getFolderIdFromPoint(e.clientX, e.clientY);
      if (targetFolderId !== null && targetFolderId !== drag.sourceFolderId) {
        onFileDropToFolder(targetFolderId, drag.fileId, drag.sourceFolderId);
        clearPointerDrag();
        return;
      }

      if (folderId !== null && folderId === drag.sourceFolderId) {
        const target = getInsertBeforeFromPoint(e.clientX, e.clientY);
        if (target !== null) {
          void commitReorder(drag.fromIndex, target);
        }
      }

      clearPointerDrag();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [pointerDragging, folderId, onFileDropToFolder]);

  useEffect(() => {
    if (!pointerDragging) return;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = prevCursor;
    };
  }, [pointerDragging]);

  // ── Checkbox select ──────────────────────────────────────────────────────
  const toggleSelect = (fileId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === folderFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(folderFiles.map((f) => f.id)));
    }
  };

  // ── Context menu ─────────────────────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent, fileId: number) => {
    e.preventDefault();
    setMovePicker(null);
    const menuW = 168;
    const menuH = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8);
    setContextMenu({ fileId, x, y });
  };

  const contextFile = contextMenu ? folderFiles.find((f) => f.id === contextMenu.fileId) : null;

  // ── Other folders (for move picker) ─────────────────────────────────────
  const otherFolders = folders.filter((f) => f.id !== folderId);

  // ── Empty states ─────────────────────────────────────────────────────────
  if (!folderId) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50/50">
        <div className="text-center">
          <Music className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-slate-500">Selecione uma pasta</p>
          <p className="text-sm mt-1">Escolha uma pasta na lateral para ver os arquivos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {dialog}

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-b bg-white flex items-center flex-shrink-0 gap-2">
        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-slate-600 font-medium">
              {selectedIds.size} selecionado(s)
            </span>

            {/* Mover para... */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                ref={bulkMoveButtonRef}
                data-move-trigger
                onClick={() => setBulkMovePicker((v) => !v)}
              >
                <FolderInput className="h-3.5 w-3.5" />
                Mover para...
              </Button>
              {bulkMovePicker && (
                <div
                  data-move-picker
                  className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]"
                >
                  {otherFolders.length === 0 ? (
                    <p className="text-xs text-slate-400 px-3 py-2">Nenhuma outra pasta</p>
                  ) : (
                    otherFolders.map((f) => (
                      <button
                        key={f.id}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        onClick={() => handleBulkMove(f.id)}
                      >
                        <FolderInput className="h-3.5 w-3.5 text-slate-400" />
                        {f.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Resetar posição */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={handleBulkResetState}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resetar posição
            </Button>

            {/* Excluir */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-slate-400"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          </div>
        ) : (
          <span className="text-sm font-medium text-slate-600 flex-1">
            {folderFiles.length} arquivo(s)
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <button
            onClick={handleToggleShuffle}
            title={currentFolder?.shuffle ? "Modo aleatório (clique para ordenado)" : "Modo ordenado (clique para aleatório)"}
            className={`flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium border transition-colors ${currentFolder?.shuffle
              ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
          >
            {currentFolder?.shuffle ? (
              <Shuffle className="h-3 w-3" />
            ) : (
              <ArrowDownUp className="h-3 w-3" />
            )}
            {currentFolder?.shuffle ? "Aleatório" : "Em ordem"}
          </button>
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1"
              data-actions-trigger
              onClick={() => setActionsMenuOpen((v) => !v)}
            >
              <MoreVertical className="h-3 w-3" />
              Ações
            </Button>
            {actionsMenuOpen && (
              <div
                data-actions-menu
                className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]"
              >
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    handleScanSilence();
                  }}
                  disabled={isScanning || folderFiles.length === 0 || scanningFolderId !== null}
                  title={
                    scanningFolderId !== null && !isScanning
                      ? "Outra pasta está sendo analisada"
                      : "Analisar silêncio inicial e final de todos os arquivos desta pasta"
                  }
                >
                  {isScanning ? (
                    <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
                  ) : (
                    <ScanLine className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  {isScanning ? "Analisando..." : "Analisar Silêncio"}
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    setShowSilenceBadge((v) => !v);
                  }}
                  title="Mostrar ou ocultar o texto da badge de silêncio"
                >
                  {showSilenceBadge ? (
                    <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  {showSilenceBadge ? "Ocultar texto da badge" : "Mostrar texto da badge"}
                </button>
              </div>
            )}
          </div>
          <Button size="sm" className="h-7 px-2 text-[11px]" onClick={handleImport}>
            <Upload className="h-3 w-3 mr-1" />
            Importar
          </Button>
        </div>
      </div>

      {/* ── File list ─────────────────────────────────────────────────────── */}
      {folderFiles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Upload className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-slate-500">Pasta vazia</p>
            <p className="text-sm mt-1">Clique em Importar para adicionar arquivos de áudio</p>
          </div>
        </div>
      ) : (
        <div
          ref={fileListContainerRef}
          className="flex-1 overflow-y-auto"
        >
          {/* Column header */}
          <div className="flex items-center px-4 py-1.5 border-b bg-slate-50 text-xs text-slate-400 font-medium select-none sticky top-0 z-10">
            <div className="w-6 flex-shrink-0" />
            <div className="w-6 flex-shrink-0 flex items-center">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300 cursor-pointer"
                checked={selectedIds.size === folderFiles.length && folderFiles.length > 0}
                onChange={toggleSelectAll}
              />
            </div>
            <div className="w-8 flex-shrink-0 text-right pr-2">#</div>
            <div className="flex-1 pl-2">Nome</div>
            <div className="w-16 text-right pr-4">Duração</div>
            <div className="w-8" />
          </div>

          {folderFiles.map((file, idx) => {
            const isSelected = selectedIds.has(file.id);
            const isDraggingThis = draggingFileId === file.id;
            const showIndicatorBefore = insertBeforeIndex === idx && dragIndexRef.current !== null && dragIndexRef.current !== idx;

            return (
              <div key={file.id}>
                {/* Drop indicator line above */}
                {showIndicatorBefore && (
                  <div className="h-0.5 bg-blue-500 mx-4 rounded-full pointer-events-none" />
                )}

                <div
                  data-file-index={idx}
                  onContextMenu={(e) => handleContextMenu(e, file.id)}
                  className={cn(
                    "flex items-center py-2.5 px-4 border-b border-slate-50 group transition-colors select-none",
                    isSelected ? "bg-blue-50" : "hover:bg-slate-50",
                    isDraggingThis && "bg-blue-50 ring-1 ring-blue-200 shadow-sm opacity-75"
                  )}
                >
                  {/* Drag handle */}
                  <div
                    onPointerDown={(e) => handlePointerDragStart(e, idx, file)}
                    className={cn(
                      "w-6 flex-shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500",
                      isDraggingThis && "text-blue-500"
                    )}
                    title="Arraste para mover/reordenar"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Checkbox */}
                  <div className="w-6 flex-shrink-0 flex items-center">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 cursor-pointer"
                      checked={isSelected}
                      onChange={() => toggleSelect(file.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Number */}
                  <div className="w-8 flex-shrink-0 text-right pr-2">
                    <span className="text-xs text-slate-300 tabular-nums">{idx + 1}</span>
                  </div>

                  {/* Music icon */}
                  <div className="h-7 w-7 rounded bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 ml-1">
                    <Music className="h-3.5 w-3.5 text-blue-500" />
                  </div>

                  {/* Name + filename */}
                  <div className="flex-1 min-w-0 pl-3">
                    {renamingId === file.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="h-7 text-sm py-0 px-2 w-48"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={commitRename}
                        />
                        <button
                          className="p-1 rounded text-green-500 hover:bg-green-50"
                          onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1 rounded text-slate-400 hover:bg-slate-100"
                          onMouseDown={(e) => { e.preventDefault(); setRenamingId(null); }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                          <SilenceBadge file={file} compact={!showSilenceBadge} />
                        </div>
                        <p className="text-xs text-slate-400 truncate">{file.filename}</p>
                      </>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="w-16 text-right pr-4 flex-shrink-0">
                    {file.duration_ms && (
                      <span className="text-xs font-mono text-slate-400">
                        {formatDuration(file.duration_ms)}
                      </span>
                    )}
                  </div>

                  {/* Actions (MoreVertical) */}
                  <div className="w-8 flex-shrink-0 flex items-center justify-center">
                    <div className="relative">
                      <button
                        data-move-trigger
                        className={cn(
                          "p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-opacity",
                          (isSelected || contextMenu?.fileId === file.id)
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, file.id);
                        }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Drop indicator at end of list */}
          {insertBeforeIndex === folderFiles.length && dragIndexRef.current !== null && (
            <div className="h-0.5 bg-blue-500 mx-4 rounded-full pointer-events-none" />
          )}
        </div>
      )}

      {/* ── Context menu ──────────────────────────────────────────────────── */}
      {contextMenu && contextFile && (
        <div
          data-context-menu
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            onClick={() => startRename(contextFile)}
          >
            <Edit2 className="h-3.5 w-3.5 text-slate-400" />
            Renomear
          </button>

          <button
            className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => handleAnalyzeSingle(contextFile)}
            disabled={scanningFolderId !== null}
          >
            {scanningFileId === contextFile.id ? (
              <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
            ) : (
              <ScanLine className="h-3.5 w-3.5 text-slate-400" />
            )}
            Analisar silêncio
          </button>

          {/* Mover para... inline sub-items */}
          <div className="relative group/move">
            <button
              className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              data-move-trigger
              onClick={(e) => {
                e.stopPropagation();
                setMovePicker(
                  movePicker?.fileId === contextFile.id
                    ? null
                    : (() => {
                      const subMenuW = 168;
                      const subMenuH = 120;
                      const rightX = contextMenu.x + 164;
                      const anchorX = rightX + subMenuW > window.innerWidth - 8
                        ? contextMenu.x - subMenuW
                        : rightX;
                      const anchorY = Math.min(contextMenu.y + 30, window.innerHeight - subMenuH - 8);
                      return { fileId: contextFile.id, anchorX, anchorY };
                    })()
                );
              }}
            >
              <FolderInput className="h-3.5 w-3.5 text-slate-400" />
              Mover para...
            </button>
          </div>

          <div className="border-t border-slate-100 my-1" />

          <button
            className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            onClick={() => handleResetState(contextFile.id)}
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            Resetar posição
          </button>

          <button
            className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            onClick={() => handleDelete(contextFile.id, contextFile.name)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
        </div>
      )}

      {/* ── Move picker (folder chooser) ──────────────────────────────────── */}
      {movePicker && folderId && (
        <div
          data-move-picker
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ top: movePicker.anchorY, left: movePicker.anchorX }}
        >
          {otherFolders.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-2">Nenhuma outra pasta</p>
          ) : (
            otherFolders.map((f) => (
              <button
                key={f.id}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                onClick={() => handleMoveFile(movePicker.fileId, folderId, f.id)}
              >
                <FolderInput className="h-3.5 w-3.5 text-slate-400" />
                {f.name}
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Drag preview ───────────────────────────────────────────────────── */}
      {dragPreview && (
        <div
          className="fixed z-[70] pointer-events-none"
          style={{ left: dragPreview.x + 14, top: dragPreview.y + 12 }}
        >
          <div className="rounded-md border border-white/40 bg-white/85 text-white shadow-lg px-2.5 py-1.5 min-w-[180px] max-w-[260px]">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Movendo arquivo</p>
            <p className="text-xs font-medium truncate text-slate-600">{dragPreview.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}
