import { useEffect } from "react";
import { Music, Trash2, RotateCcw, Upload } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAudioStore } from "@/stores/audioStore";
import { audioService } from "@/services/audioService";
import { formatDuration } from "@/lib/utils";
import { toast } from "sonner";

export function AudioFileList() {
  const { selectedFolderId, files, addFiles, removeFile, fetchFiles } = useAudioStore();
  const { confirm, dialog } = useConfirm();
  const folderId = selectedFolderId;
  const folderFiles = folderId ? (files[folderId] ?? []) : [];

  useEffect(() => {
    if (folderId) fetchFiles(folderId);
  }, [folderId, fetchFiles]);

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
    } catch (e) {
      toast.error(`Erro ao importar: ${e}`);
    }
  };

  const handleDelete = async (fileId: number, fileName: string) => {
    if (!folderId) return;
    if (!await confirm({ message: `Remover "${fileName}"?`, confirmLabel: "Remover" })) return;
    try {
      await audioService.deleteFile(fileId);
      removeFile(folderId, fileId);
      toast.success("Arquivo removido");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const handleResetState = async (fileId: number) => {
    try {
      await audioService.resetPlaybackState(fileId);
      toast.success("Estado de reprodução resetado");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  if (!folderId) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <Music className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Selecione uma pasta para ver os arquivos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {dialog}
      <div className="p-4 border-b flex items-center justify-between">
        <span className="font-semibold text-slate-700">
          {folderFiles.length} arquivo(s)
        </span>
        <Button size="sm" onClick={handleImport}>
          <Upload className="h-4 w-4 mr-1" />
          Importar
        </Button>
      </div>

      {folderFiles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Upload className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum arquivo. Clique em Importar.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {folderFiles.map((file, idx) => (
            <div
              key={file.id}
              className="flex items-center gap-3 px-4 py-3 border-b hover:bg-slate-50 group"
            >
              <span className="text-xs text-slate-400 w-6 text-right">{idx + 1}</span>
              <Music className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-slate-400 truncate">{file.filename}</p>
              </div>
              {file.duration_ms && (
                <Badge variant="secondary" className="text-xs">
                  {formatDuration(file.duration_ms)}
                </Badge>
              )}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  title="Resetar posição de reprodução"
                  onClick={() => handleResetState(file.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(file.id, file.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
