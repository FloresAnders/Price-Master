import { useCallback, useRef, useState, type RefObject } from "react";

interface Props {
  isComponentMountedRef: RefObject<boolean>;
}

export function useMovementsLoadingState({ isComponentMountedRef }: Props) {
  const [movementsLoading, setMovementsLoading] = useState(false);
  const movementsLoadingCountRef = useRef(0);

  const beginMovementsLoading = useCallback(() => {
    movementsLoadingCountRef.current += 1;
    setMovementsLoading(true);
  }, []);

  const endMovementsLoading = useCallback(() => {
    movementsLoadingCountRef.current = Math.max(
      0,
      movementsLoadingCountRef.current - 1,
    );
    if (!isComponentMountedRef.current) return;
    if (movementsLoadingCountRef.current === 0) {
      setMovementsLoading(false);
    }
  }, [isComponentMountedRef]);

  return {
    movementsLoading,
    movementsLoadingCountRef,
    beginMovementsLoading,
    endMovementsLoading,
  };
}
