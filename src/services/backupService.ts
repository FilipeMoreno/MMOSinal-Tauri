import { invoke } from "@tauri-apps/api/core";
import type { BackupResult, AppSettings } from "@/types";

export const backupService = {
  async triggerManual(): Promise<BackupResult> {
    return invoke<BackupResult>("trigger_backup");
  },
};

export const settingsService = {
  async get(): Promise<AppSettings> {
    return invoke<AppSettings>("get_settings");
  },

  async save(settings: AppSettings): Promise<void> {
    return invoke<void>("save_settings", { settings });
  },
};
