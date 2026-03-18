import { invoke } from "@tauri-apps/api/core";
import type { TimeSyncResult } from "@/types";

export const timesyncService = {
  syncTime(ntpServer: string): Promise<TimeSyncResult> {
    return invoke<TimeSyncResult>("sync_time", { ntpServer });
  },
};
