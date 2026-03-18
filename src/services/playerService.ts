import { invoke } from "@tauri-apps/api/core";
import type { PlayerState } from "@/types";

export const playerService = {
  async getState(): Promise<PlayerState> {
    return invoke<PlayerState>("get_player_state");
  },

  async playManual(audioFileId: number): Promise<void> {
    return invoke<void>("play_manual", { audioFileId });
  },

  async seekPlayer(positionMs: number): Promise<void> {
    return invoke<void>("seek_player", { positionMs });
  },

  async stop(): Promise<void> {
    return invoke<void>("stop_player");
  },
};
