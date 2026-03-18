import { useState, useCallback } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
}

export function useConfirm() {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const normalized: ConfirmOptions =
      typeof options === "string" ? { message: options } : options;
    return new Promise((resolve) => {
      setState({ options: normalized, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const dialog = state ? (
    <ConfirmDialog
      open
      title={state.options.title}
      message={state.options.message}
      confirmLabel={state.options.confirmLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, dialog };
}
