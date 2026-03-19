import { useState } from "react";
import { Plus, Folder, FolderOpen, Trash2, Edit2 } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAudioStore } from "@/stores/audioStore";
import { audioService } from "@/services/audioService";
import { changeLogService } from "@/services/changeLogService";
import { Shuffle } from "lucide-react";
import { toast } from "sonner";
import type { AudioFolder } from "@/types";

interface FolderSidebarProps {
  onFileDrop: (targetFolderId: number, fileId: number) => void;
}

export function FolderSidebar({ onFileDrop }: FolderSidebarProps) {
  const { folders, selectedFolderId, selectFolder, addFolder, updateFolder, removeFolder } =
    useAudioStore();
  const { confirm, dialog } = useConfirm();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);

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
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const handleDelete = async (folder: AudioFolder) => {
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
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
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
    const fileId = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(fileId)) {
      onFileDrop(folderId, fileId);
    }
  };

  return (
    <div className="w-56 flex-shrink-0 border-r border-slate-100 bg-white flex flex-col">
      {dialog}

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Pastas</span>
        <Button size="icon" variant="ghost" onClick={() => setCreating(true)} className="h-6 w-6 text-slate-400 hover:text-slate-600">
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

      <div className="flex-1 overflow-y-auto py-1">
        {folders.map((folder) => {
          const isSelected = selectedFolderId === folder.id;
          const isDragOver = dragOverFolderId === folder.id;

          return (
            <div
              key={folder.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-all duration-100 border-l-2",
                isSelected
                  ? "bg-blue-50 text-blue-700 border-l-blue-500 font-medium"
                  : isDragOver
                    ? "bg-blue-100 border-l-blue-500 text-slate-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 border-l-transparent"
              )}
              onClick={() => selectFolder(folder.id)}
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

              <div className={cn(
                "flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                (isSelected || editingId === folder.id) && "opacity-100"
              )}>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingId(folder.id); setEditName(folder.name); }}
                  className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(folder); }}
                  className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}

        {folders.length === 0 && (
          <div className="px-4 py-6 text-center">
            <Folder className="h-8 w-8 mx-auto mb-2 text-slate-200" />
            <p className="text-xs text-slate-400">Nenhuma pasta</p>
            <button
              onClick={() => setCreating(true)}
              className="text-xs text-blue-500 hover:text-blue-600 mt-1"
            >
              Criar pasta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
