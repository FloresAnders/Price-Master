"use client";

import { useInternalToast } from '../components/ui/ToastProvider';

export default function useToast() {
  const { showToast } = useInternalToast();
  return { showToast };
}
