import { invoke } from "@tauri-apps/api/core";
import type { Schedule, ScheduleFormData, NextSignal } from "@/types";

export const scheduleService = {
  async list(): Promise<Schedule[]> {
    return invoke<Schedule[]>("list_schedules");
  },

  async get(id: number): Promise<Schedule | null> {
    return invoke<Schedule | null>("get_schedule", { id });
  },

  async create(data: ScheduleFormData): Promise<Schedule> {
    return invoke<Schedule>("create_schedule", { data });
  },

  async update(id: number, data: ScheduleFormData): Promise<Schedule> {
    return invoke<Schedule>("update_schedule", { id, data });
  },

  async remove(id: number): Promise<void> {
    return invoke<void>("delete_schedule", { id });
  },

  async toggleActive(id: number, active: boolean): Promise<void> {
    return invoke<void>("toggle_schedule_active", { id, active });
  },

  async getNextSignal(): Promise<NextSignal | null> {
    return invoke<NextSignal | null>("get_next_signal");
  },

  async duplicate(id: number): Promise<Schedule> {
    return invoke<Schedule>("duplicate_schedule", { id });
  },
};
