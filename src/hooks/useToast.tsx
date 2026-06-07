"use client";

import { toast } from "sonner";

export type ToastType = "success" | "error" | "info" | "warning";

export default function useToast() {
  const showToast = (message: string, type: ToastType = "info", duration?: number) => {
    toast[type](message, duration ? { duration } : undefined);
  };
  return { showToast };
}
