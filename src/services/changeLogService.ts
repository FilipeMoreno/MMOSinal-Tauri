import { invoke } from "@tauri-apps/api/core";
import type { ChangeLog } from "@/types";

export const changeLogService = {
  log(
    action: string,
    entityType: string,
    entityName?: string | null,
    details?: string | null,
  ): Promise<void> {
    return invoke("log_change", {
      action,
      entityType,
      entityName: entityName ?? null,
      details: details ?? null,
    });
  },

  list(limit = 500): Promise<ChangeLog[]> {
    return invoke("list_change_logs", { limit });
  },

  clearAll(): Promise<void> {
    return invoke("clear_change_logs");
  },
};
