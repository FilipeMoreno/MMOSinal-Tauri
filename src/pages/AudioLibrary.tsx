import { useEffect } from "react";
import { FolderSidebar } from "@/components/audio/FolderSidebar";
import { AudioFileList } from "@/components/audio/AudioFileList";
import { useAudioStore } from "@/stores/audioStore";

export function AudioLibrary() {
  const { fetchFolders } = useAudioStore();

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Biblioteca de Áudio</h1>
      </div>
      <div className="flex flex-1 overflow-hidden border-t">
        <FolderSidebar />
        <AudioFileList />
      </div>
    </div>
  );
}
