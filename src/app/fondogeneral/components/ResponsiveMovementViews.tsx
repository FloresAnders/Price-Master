"use client";

import { useEffect, useState, type ReactNode } from "react";

const COMPACT_MOVEMENTS_QUERY = "(max-width: 639px)";

interface Props {
  renderMobile: () => ReactNode;
  renderDesktop: () => ReactNode;
}

export function ResponsiveMovementViews({
  renderMobile,
  renderDesktop,
}: Props) {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(COMPACT_MOVEMENTS_QUERY);
    const syncLayout = () => setIsCompact(mediaQuery.matches);

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);
    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  return <>{isCompact ? renderMobile() : renderDesktop()}</>;
}
