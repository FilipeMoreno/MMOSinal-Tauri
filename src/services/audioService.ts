import { invoke } from "@tauri-apps/api/core";
import type { AudioFolder, AudioFile } from "@/types";

export const audioService = {
  // ── Folders ──────────────────────────────────────────────────────────────
  async listFolders(): Promise<AudioFolder[]> {
    return invoke<AudioFolder[]>("list_audio_folders");
  },

  async createFolder(name: string, description: string | null, shuffle = false): Promise<AudioFolder> {
    return invoke<AudioFolder>("create_audio_folder", { name, description, shuffle });
  },

  async updateFolder(id: number, name: string, description: string | null, shuffle?: boolean): Promise<AudioFolder> {
    return invoke<AudioFolder>("update_audio_folder", { id, name, description, shuffle: shuffle ?? null });
  },

  async toggleShuffle(id: number, shuffle: boolean): Promise<AudioFolder> {
    return invoke<AudioFolder>("update_folder_shuffle", { id, shuffle });
  },

  async deleteFolder(id: number): Promise<void> {
    return invoke<void>("delete_audio_folder", { id });
  },

  // ── Files ─────────────────────────────────────────────────────────────────
  async listFiles(folderId: number): Promise<AudioFile[]> {
    return invoke<AudioFile[]>("list_audio_files", { folderId });
  },

  async importFiles(folderId: number, filePaths: string[]): Promise<AudioFile[]> {
    return invoke<AudioFile[]>("import_audio_files", { folderId, filePaths });
  },

  async deleteFile(id: number): Promise<void> {
    return invoke<void>("delete_audio_file", { id });
  },

  async reorderFiles(folderId: number, orderedIds: number[]): Promise<void> {
    return invoke<void>("reorder_audio_files", { folderId, orderedIds });
  },

  async resetPlaybackState(audioFileId: number): Promise<void> {
    return invoke<void>("reset_playback_state", { audioFileId });
  },

  async renameFile(id: number, name: string): Promise<AudioFile> {
    return invoke<AudioFile>("rename_audio_file", { id, name });
  },

  async moveFile(fileId: number, targetFolderId: number): Promise<AudioFile> {
    return invoke<AudioFile>("move_audio_file", { fileId, targetFolderId });
  },

  async analyzeFileSilence(fileId: number): Promise<AudioFile> {
    return invoke<AudioFile>("analyze_file_silence", { fileId });
  },

  async scanFolderSilence(folderId: number): Promise<AudioFile[]> {
    return invoke<AudioFile[]>("scan_folder_silence", { folderId });
  },
};
