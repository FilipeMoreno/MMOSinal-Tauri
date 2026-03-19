import { invoke } from "@tauri-apps/api/core";
import type { ImportResult } from "@/types";

export const configService = {
  exportConfig: (path: string) =>
    invoke<void>("export_config", { path }),

  importConfig: (path: string) =>
    invoke<ImportResult>("import_config", { path }),
};
