import { useEffect, useState } from "react";
import { FolderSidebar } from "@/components/audio/FolderSidebar";
import { AudioFileList } from "@/components/audio/AudioFileList";
import { useAudioStore } from "@/stores/audioStore";
import { audioService } from "@/services/audioService";
import { toast } from "sonner";

export function AudioLibrary() {
  const { fetchFolders, folders, selectedFolderId, moveFile: moveFileInStore } = useAudioStore();
  const [draggingFileId, setDraggingFileId] = useState<number | null>(null);
  const [draggingSourceFolderId, setDraggingSourceFolderId] = useState<number | null>(null);
  const [draggingTargetFolderId, setDraggingTargetFolderId] = useState<number | null>(null);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const handleFileDrop = async (
    targetFolderId: number,
    fileId: number,
    sourceFolderIdFromDrag: number | null,
  ) => {
    const sourceFolderId = sourceFolderIdFromDrag ?? draggingSourceFolderId ?? selectedFolderId;
    if (sourceFolderId === null || sourceFolderId === targetFolderId) return;
    setDraggingFileId(null);
    setDraggingSourceFolderId(null);
    setDraggingTargetFolderId(null);
    try {
      const updated = await audioService.moveFile(fileId, targetFolderId);
      moveFileInStore(fileId, sourceFolderId, targetFolderId, updated);
      toast.success("Arquivo movido");
    } catch (e) {
      toast.error(`Erro ao mover: ${e}`);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="px-6 py-5 border-b bg-white flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-800">Biblioteca de Áudio</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gerencie pastas e arquivos de áudio para os sinais</p>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <FolderSidebar
          draggingFileId={draggingFileId}
          draggingSourceFolderId={draggingSourceFolderId}
          draggingTargetFolderId={draggingTargetFolderId}
          onFileDrop={handleFileDrop}
        />
        <AudioFileList
          draggingFileId={draggingFileId}
          setDraggingFileId={setDraggingFileId}
          setDraggingSourceFolderId={setDraggingSourceFolderId}
          setDraggingTargetFolderId={setDraggingTargetFolderId}
          onFileDropToFolder={handleFileDrop}
          currentFolder={folders.find((f) => f.id === selectedFolderId) ?? null}
        />
      </div>
    </div>
  );
}
