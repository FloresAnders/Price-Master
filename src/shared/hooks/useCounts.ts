// src/hooks/useCounts.ts (or .tsx)
import { useState, useCallback } from 'react';

export type CountState = Record<number, string>;

// Utility to create initial count state
const buildInitialCounts = (denominations: readonly number[]): CountState => {
  return denominations.reduce((acc, denom) => {
    acc[denom] = "";
    return acc;
  }, {} as CountState);
};

/**
 * Custom hook to manage and interact with a set of denomination counts.
 * @param denominations Array of currency/bill values (e.g., [2000, 1000, ...])
 * @returns {countState: CountState, setCounts: React.Dispatch<React.SetStateAction<CountState>>, calculateTotal: Function}
 */
export const useCounts = (denominations: readonly number[]) => {
  const [counts, setCounts] = useState<CountState>(() => buildInitialCounts(denominations));

  // Input handler for manual text entry
  const handleCountChange = useCallback((denom: number, value: string) => {
    const sanitized = value.replace(/[^0-9]/g, "");
    setCounts((prev) => ({ ...prev, [denom]: sanitized }));
  }, []);

  // Increment count
  const incrementCount = useCallback((denom: number) => {
    const current = Number.parseInt(counts[denom] || "0", 10) || 0;
    setCounts((prev) => ({ ...prev, [denom]: String(current + 1) }));
  }, [counts]);

  // Decrement count
  const decrementCount = useCallback((denom: number) => {
    const current = Number.parseInt(counts[denom] || "0", 10) || 0;
    const next = Math.max(0, current - 1);
    setCounts((prev) => ({ ...prev, [denom]: String(next) }));
  }, [counts]);

  // Recalculate total based on current counts
  const calculateTotal = useCallback(() => {
    return denominations.reduce((sum, denom) => {
      const quantity = Number.parseInt(counts[denom] || "0", 10) || 0;
      return sum + denom * quantity;
    }, 0);
  }, [counts, denominations]); // Denom must be in scope

  return { counts, setCounts, handleCountChange, incrementCount, decrementCount, calculateTotal };
};
