import { useEffect, useState } from "react";
import { Plus, Folder, FolderOpen, Trash2, Edit2, Check, X, Shuffle } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAudioStore } from "@/stores/audioStore";
import { audioService } from "@/services/audioService";
import { changeLogService } from "@/services/changeLogService";
import { AUDIO_FILE_DND_MIME, AUDIO_SOURCE_FOLDER_DND_MIME } from "@/components/audio/dnd";
import { toast } from "sonner";
import type { AudioFolder } from "@/types";

interface FolderSidebarProps {
  draggingFileId: number | null;
  draggingSourceFolderId: number | null;
  draggingTargetFolderId: number | null;
  onFileDrop: (targetFolderId: number, fileId: number, sourceFolderId: number | null) => void;
}

interface FolderContextMenu {
  folderId: number | null;
  x: number;
  y: number;
}

export function FolderSidebar({
  draggingFileId,
  draggingSourceFolderId,
  draggingTargetFolderId,
  onFileDrop,
}: FolderSidebarProps) {
  const { folders, selectedFolderId, selectFolder, addFolder, updateFolder, removeFolder } =
    useAudioStore();
  const { confirm, dialog } = useConfirm();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<FolderContextMenu | null>(null);

  const parseDraggedInt = (value: string): number | null => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const getFolderIdFromTarget = (target: EventTarget | null): number | null => {
    if (!(target instanceof HTMLElement)) return null;
    const row = target.closest<HTMLElement>("[data-folder-id]");
    if (!row) return null;
    const raw = row.dataset.folderId;
    if (!raw) return null;
    return parseDraggedInt(raw);
  };

  const isAudioFileDrag = (e: React.DragEvent): boolean => {
    if (draggingFileId !== null) return true;
    const types = Array.from(e.dataTransfer.types ?? []);
    return types.includes(AUDIO_FILE_DND_MIME) || types.includes("text/plain");
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const folder = await audioService.createFolder(newName.trim(), null);
      addFolder(folder);
      setNewName("");
      setCreating(false);
      selectFolder(folder.id);
      toast.success("Pasta criada");
      changeLogService.log("created", "audio_folder", folder.name);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const handleRename = async (folder: AudioFolder) => {
    if (!editName.trim()) return;
    try {
      const updated = await audioService.updateFolder(folder.id, editName.trim(), folder.description, folder.shuffle);
      changeLogService.log("renamed", "audio_folder", updated.name, `Antes: ${folder.name}`);
      updateFolder(updated);
      setEditingId(null);
      setContextMenu(null);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const handleDelete = async (folder: AudioFolder) => {
    setContextMenu(null);
    if (!await confirm({ message: `Remover pasta "${folder.name}" e todos os arquivos?`, confirmLabel: "Remover" })) return;
    try {
      await audioService.deleteFolder(folder.id);
      removeFolder(folder.id);
      if (selectedFolderId === folder.id) selectFolder(null);
      toast.success("Pasta removida");
      changeLogService.log("deleted", "audio_folder", folder.name);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const handleDragOver = (e: React.DragEvent, folderId: number) => {
    // Always preventDefault so browser allows the drop — don't rely on React state here
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (isAudioFileDrag(e)) {
      setDragOverFolderId(folderId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving this folder row entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFolderId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    const fileRaw = e.dataTransfer.getData(AUDIO_FILE_DND_MIME) || e.dataTransfer.getData("text/plain");
    const sourceRaw = e.dataTransfer.getData(AUDIO_SOURCE_FOLDER_DND_MIME);
    const fileId = parseDraggedInt(fileRaw) ?? draggingFileId;
    const sourceFolderId = parseDraggedInt(sourceRaw) ?? draggingSourceFolderId;
    if (fileId !== null) {
      onFileDrop(folderId, fileId, sourceFolderId);
    }
  };

  const handleSidebarDragOverCapture = (e: React.DragEvent) => {
    e.preventDefault();
    if (isAudioFileDrag(e)) {
      e.dataTransfer.dropEffect = "move";
      const folderId = getFolderIdFromTarget(e.target);
      setDragOverFolderId(folderId);
    }
  };

  const handleSidebarDropCapture = (e: React.DragEvent) => {
    e.preventDefault();
    const folderId = getFolderIdFromTarget(e.target) ?? dragOverFolderId;
    setDragOverFolderId(null);
    if (folderId === null) return;

    const fileRaw = e.dataTransfer.getData(AUDIO_FILE_DND_MIME) || e.dataTransfer.getData("text/plain");
    const sourceRaw = e.dataTransfer.getData(AUDIO_SOURCE_FOLDER_DND_MIME);
    const fileId = parseDraggedInt(fileRaw) ?? draggingFileId;
    const sourceFolderId = parseDraggedInt(sourceRaw) ?? draggingSourceFolderId;
    if (fileId !== null) {
      e.stopPropagation();
      onFileDrop(folderId, fileId, sourceFolderId);
    }
  };

  const handleSidebarDragLeaveCapture = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFolderId(null);
    }
  };

  const startCreate = () => {
    setContextMenu(null);
    setEditingId(null);
    setNewName("");
    setCreating(true);
  };

  const startEdit = (folder: AudioFolder) => {
    setContextMenu(null);
    setCreating(false);
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  const openContextMenu = (e: React.MouseEvent, folderId: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 176;
    const menuHeight = folderId === null ? 44 : 116;
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - menuWidth - 8));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 8));

    if (folderId !== null) {
      selectFolder(folderId);
    }

    setContextMenu({ folderId, x, y });
  };

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-folder-context-menu]")) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const contextMenuFolder = contextMenu?.folderId === null
    ? null
    : folders.find((f) => f.id === contextMenu?.folderId) ?? null;

  return (
    <div
      className="w-56 flex-shrink-0 border-r border-slate-100 bg-white flex flex-col transition-colors"
      onDragOverCapture={handleSidebarDragOverCapture}
      onDropCapture={handleSidebarDropCapture}
      onDragLeaveCapture={handleSidebarDragLeaveCapture}
    >
      {dialog}

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Pastas</span>
        <Button size="icon" variant="ghost" onClick={startCreate} className="h-6 w-6 text-slate-400 hover:text-slate-600">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {creating && (
        <div className="p-2 border-b border-slate-100">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da pasta"
            className="h-8 text-sm mb-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreate}>Criar</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(false)}>✕</Button>
          </div>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto py-1"
        onContextMenu={(e) => openContextMenu(e, getFolderIdFromTarget(e.target))}
      >
        {folders.map((folder) => {
          const isSelected = selectedFolderId === folder.id;
          const isDragOver = draggingTargetFolderId === folder.id || dragOverFolderId === folder.id;

          return (
            <div
              key={folder.id}
              data-folder-id={folder.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-all duration-100 border-l-2",
                isSelected
                  ? "bg-blue-50 text-blue-700 border-l-blue-500 font-medium"
                  : isDragOver
                    ? "bg-blue-100 border-l-blue-500 text-slate-800 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 border-l-transparent"
              )}
              onClick={() => {
                if (draggingFileId !== null) return;
                selectFolder(folder.id);
              }}
              onDragEnter={(e) => handleDragOver(e, folder.id)}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
            >
              {isSelected ? (
                <FolderOpen className="h-4 w-4 flex-shrink-0 text-blue-500" />
              ) : (
                <Folder className={cn("h-4 w-4 flex-shrink-0", isDragOver ? "text-blue-500" : "text-slate-400")} />
              )}

              {editingId === folder.id ? (
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-6 text-xs py-0 px-1 flex-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(folder);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <span className="flex-1 truncate min-w-0">{folder.name}</span>
              )}

              {folder.shuffle && editingId !== folder.id && (
                <span title="Modo aleatório"><Shuffle className="h-3 w-3 flex-shrink-0 text-blue-400" /></span>
              )}

              {isDragOver && draggingFileId !== null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-300 bg-white text-blue-600 font-medium leading-none">
                  Soltar aqui
                </span>
              )}

              <div className={cn(
                "flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                (isSelected || editingId === folder.id) && "opacity-100"
              )}>
                {editingId === folder.id ? (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRename(folder); }}
                      className="p-0.5 rounded hover:bg-green-50 text-green-500"
                      title="Salvar"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                      title="Cancelar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(folder); }}
                      className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                      title="Renomear"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(folder); }}
                      className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {folders.length === 0 && (
          <div className="px-4 py-6 text-center">
            <Folder className="h-8 w-8 mx-auto mb-2 text-slate-200" />
            <p className="text-xs text-slate-400">Nenhuma pasta</p>
            <button
              onClick={startCreate}
              className="text-xs text-blue-500 hover:text-blue-600 mt-1"
            >
              Criar pasta
            </button>
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          data-folder-context-menu
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[168px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            onClick={startCreate}
          >
            <Plus className="h-3.5 w-3.5 text-slate-400" />
            Criar pasta
          </button>

          {contextMenuFolder && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                onClick={() => startEdit(contextMenuFolder)}
              >
                <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                Editar
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={() => handleDelete(contextMenuFolder)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
