import { invoke } from "@tauri-apps/api/core";
import type { PanicButton, InterruptMode } from "@/types";

export const panicService = {
  async list(): Promise<PanicButton[]> {
    return invoke<PanicButton[]>("list_panic_buttons");
  },

  async create(
    name: string,
    audioFileId: number,
    interruptMode: InterruptMode,
    colorHex: string
  ): Promise<PanicButton> {
    return invoke<PanicButton>("create_panic_button", {
      name,
      audioFileId,
      interruptMode,
      colorHex,
    });
  },

  async update(
    id: number,
    name: string,
    audioFileId: number,
    interruptMode: InterruptMode,
    colorHex: string
  ): Promise<PanicButton> {
    return invoke<PanicButton>("update_panic_button", {
      id,
      name,
      audioFileId,
      interruptMode,
      colorHex,
    });
  },

  async remove(id: number): Promise<void> {
    return invoke<void>("delete_panic_button", { id });
  },

  async trigger(id: number): Promise<void> {
    return invoke<void>("trigger_panic_button", { id });
  },
};
