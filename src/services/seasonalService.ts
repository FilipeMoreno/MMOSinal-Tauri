import { invoke } from "@tauri-apps/api/core";
import type { SeasonalOverride, SeasonalOverrideFormData } from "@/types";

export const seasonalService = {
  async list(): Promise<SeasonalOverride[]> {
    return invoke<SeasonalOverride[]>("list_seasonal_overrides");
  },

  async create(data: SeasonalOverrideFormData): Promise<SeasonalOverride> {
    return invoke<SeasonalOverride>("create_seasonal_override", { data });
  },

  async update(id: number, data: SeasonalOverrideFormData): Promise<SeasonalOverride> {
    return invoke<SeasonalOverride>("update_seasonal_override", { id, data });
  },

  async remove(id: number): Promise<void> {
    return invoke<void>("delete_seasonal_override", { id });
  },

  async toggle(id: number, isActive: boolean): Promise<SeasonalOverride> {
    return invoke<SeasonalOverride>("toggle_seasonal_override", { id, isActive });
  },
};
