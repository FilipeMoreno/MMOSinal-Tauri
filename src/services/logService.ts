import { invoke } from "@tauri-apps/api/core";
import type { ExecutionLog } from "@/types";

export const logService = {
  async list(limit?: number, offset?: number): Promise<ExecutionLog[]> {
    return invoke<ExecutionLog[]>("list_execution_logs", {
      limit: limit ?? 100,
      offset: offset ?? 0,
    });
  },

  async clearAll(): Promise<void> {
    return invoke<void>("clear_execution_logs");
  },
};
