import { create } from "zustand";
import type { AudioFolder, AudioFile } from "@/types";
import { audioService } from "@/services/audioService";

interface AudioStore {
  folders: AudioFolder[];
  files: Record<number, AudioFile[]>; // folderId -> files
  selectedFolderId: number | null;
  loading: boolean;
  error: string | null;
  fetchFolders: () => Promise<void>;
  fetchFiles: (folderId: number) => Promise<void>;
  selectFolder: (id: number | null) => void;
  addFolder: (f: AudioFolder) => void;
  updateFolder: (f: AudioFolder) => void;
  removeFolder: (id: number) => void;
  addFiles: (folderId: number, files: AudioFile[]) => void;
  removeFile: (folderId: number, fileId: number) => void;
  setFiles: (folderId: number, files: AudioFile[]) => void;
  moveFile: (fileId: number, sourceFolderId: number, targetFolderId: number, updatedFile: AudioFile) => void;
  renameFileInStore: (folderId: number, fileId: number, name: string) => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  folders: [],
  files: {},
  selectedFolderId: null,
  loading: false,
  error: null,

  fetchFolders: async () => {
    set({ loading: true, error: null });
    try {
      const folders = await audioService.listFolders();
      set({ folders, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchFiles: async (folderId) => {
    try {
      const files = await audioService.listFiles(folderId);
      set((state) => ({ files: { ...state.files, [folderId]: files } }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  selectFolder: (id) => set({ selectedFolderId: id }),

  addFolder: (f) => set((state) => ({ folders: [...state.folders, f] })),

  updateFolder: (f) =>
    set((state) => ({
      folders: state.folders.map((x) => (x.id === f.id ? f : x)),
    })),

  removeFolder: (id) =>
    set((state) => {
      const folders = state.folders.filter((x) => x.id !== id);
      const files = { ...state.files };
      delete files[id];
      return { folders, files };
    }),

  addFiles: (folderId, newFiles) =>
    set((state) => ({
      files: {
        ...state.files,
        [folderId]: [...(state.files[folderId] ?? []), ...newFiles],
      },
    })),

  removeFile: (folderId, fileId) =>
    set((state) => ({
      files: {
        ...state.files,
        [folderId]: (state.files[folderId] ?? []).filter((f) => f.id !== fileId),
      },
    })),

  setFiles: (folderId, files) =>
    set((state) => ({
      files: { ...state.files, [folderId]: files },
    })),

  moveFile: (fileId, sourceFolderId, targetFolderId, updatedFile) =>
    set((state) => {
      const sourceFiles = (state.files[sourceFolderId] ?? []).filter((f) => f.id !== fileId);
      const targetFiles = [...(state.files[targetFolderId] ?? []), updatedFile];
      return {
        files: {
          ...state.files,
          [sourceFolderId]: sourceFiles,
          [targetFolderId]: targetFiles,
        },
      };
    }),

  renameFileInStore: (folderId, fileId, name) =>
    set((state) => ({
      files: {
        ...state.files,
        [folderId]: (state.files[folderId] ?? []).map((f) =>
          f.id === fileId ? { ...f, name } : f
        ),
      },
    })),
}));
