import { useState } from "react";
import { Plus, FolderOpen, Trash2, Edit2 } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAudioStore } from "@/stores/audioStore";
import { audioService } from "@/services/audioService";
import { toast } from "sonner";
import type { AudioFolder } from "@/types";

export function FolderSidebar() {
  const { folders, selectedFolderId, selectFolder, addFolder, updateFolder, removeFolder } =
    useAudioStore();
  const { confirm, dialog } = useConfirm();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const folder = await audioService.createFolder(newName.trim(), null);
      addFolder(folder);
      setNewName("");
      setCreating(false);
      selectFolder(folder.id);
      toast.success("Pasta criada");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const handleRename = async (folder: AudioFolder) => {
    if (!editName.trim()) return;
    try {
      const updated = await audioService.updateFolder(folder.id, editName.trim(), folder.description);
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
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  return (
    <div className="w-56 flex-shrink-0 border-r bg-slate-50 flex flex-col">
      {dialog}
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600">Pastas</span>
        <Button size="icon" variant="ghost" onClick={() => setCreating(true)} className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {creating && (
        <div className="p-2 border-b">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da pasta"
            className="h-8 text-sm mb-1"
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
        {folders.map((folder) => (
          <div
            key={folder.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md mx-1 text-sm",
              selectedFolderId === folder.id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-slate-200 text-slate-700"
            )}
            onClick={() => selectFolder(folder.id)}
          >
            <FolderOpen className="h-4 w-4 flex-shrink-0" />
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
              <span className="flex-1 truncate">{folder.name}</span>
            )}
            <div className={cn(
              "flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
              selectedFolderId === folder.id && "opacity-100"
            )}>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingId(folder.id); setEditName(folder.name); }}
                className="p-0.5 rounded hover:bg-black/10"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(folder); }}
                className="p-0.5 rounded hover:bg-destructive/20 text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
