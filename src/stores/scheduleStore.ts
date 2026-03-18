import { create } from "zustand";
import type { Schedule, NextSignal } from "@/types";
import { scheduleService } from "@/services/scheduleService";

interface ScheduleStore {
  schedules: Schedule[];
  nextSignal: NextSignal | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  fetchNextSignal: () => Promise<void>;
  add: (s: Schedule) => void;
  update: (s: Schedule) => void;
  remove: (id: number) => void;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  schedules: [],
  nextSignal: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const schedules = await scheduleService.list();
      set({ schedules, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchNextSignal: async () => {
    try {
      const nextSignal = await scheduleService.getNextSignal();
      set({ nextSignal });
    } catch {
      // silent
    }
  },

  add: (s) => set((state) => ({ schedules: [...state.schedules, s] })),

  update: (s) =>
    set((state) => ({
      schedules: state.schedules.map((x) => (x.id === s.id ? s : x)),
    })),

  remove: (id) =>
    set((state) => ({
      schedules: state.schedules.filter((x) => x.id !== id),
    })),
}));
