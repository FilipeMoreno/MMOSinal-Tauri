import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import type { PlayerState, AudioFile, Schedule } from "@/types";

interface PlayerStore extends PlayerState {
  setStatus: (status: PlayerState["status"]) => void;
  setCurrentFile: (file: AudioFile | null) => void;
  setPosition: (ms: number) => void;
  setVolume: (v: number) => void;
  updateFromEvent: (state: PlayerState) => void;
  initListener: () => Promise<() => void>;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  status: "idle",
  current_file: null,
  current_schedule: null,
  position_ms: 0,
  volume: 1.0,

  setStatus: (status) => set({ status }),
  setCurrentFile: (file) => set({ current_file: file }),
  setPosition: (ms) => set({ position_ms: ms }),
  setVolume: (v) => set({ volume: v }),
  updateFromEvent: (state) => set(state),

  initListener: async () => {
    const unlisten = await listen<PlayerState>("player-state-changed", (event) => {
      set(event.payload);
    });
    return unlisten;
  },
}));
