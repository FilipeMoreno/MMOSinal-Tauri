import { invoke } from "@tauri-apps/api/core";
import type { AudioFolder, AudioFile } from "@/types";

export const audioService = {
  // ── Folders ──────────────────────────────────────────────────────────────
  async listFolders(): Promise<AudioFolder[]> {
    return invoke<AudioFolder[]>("list_audio_folders");
  },

  async createFolder(name: string, description: string | null): Promise<AudioFolder> {
    return invoke<AudioFolder>("create_audio_folder", { name, description });
  },

  async updateFolder(id: number, name: string, description: string | null): Promise<AudioFolder> {
    return invoke<AudioFolder>("update_audio_folder", { id, name, description });
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
};
