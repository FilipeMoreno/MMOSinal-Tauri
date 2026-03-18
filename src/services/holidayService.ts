import { invoke } from "@tauri-apps/api/core";
import type { Holiday } from "@/types";

export const holidayService = {
  async list(): Promise<Holiday[]> {
    return invoke<Holiday[]>("list_holidays");
  },

  async create(name: string, date: string, isRecurring: boolean): Promise<Holiday> {
    return invoke<Holiday>("create_holiday", { name, date, isRecurring });
  },

  async update(id: number, name: string, date: string, isRecurring: boolean): Promise<Holiday> {
    return invoke<Holiday>("update_holiday", { id, name, date, isRecurring });
  },

  async remove(id: number): Promise<void> {
    return invoke<void>("delete_holiday", { id });
  },
};
