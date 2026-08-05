export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function isScrollPastBackToTopThreshold({
  scrollTop,
  viewportHeight,
  showAfterViewportRatio,
}: {
  scrollTop: number;
  viewportHeight: number;
  showAfterViewportRatio: number;
}): boolean {
  const safeScrollTop = Math.max(0, scrollTop);
  const thresholdPx = Math.max(0, viewportHeight) * clamp01(showAfterViewportRatio);
  return safeScrollTop > 0 && safeScrollTop >= thresholdPx;
}

export function shouldRenderBackToTop({
  alwaysVisible,
  isPastScrollThreshold,
  suppressed,
}: {
  alwaysVisible: boolean;
  isPastScrollThreshold: boolean;
  suppressed: boolean;
}): boolean {
  if (suppressed) return false;
  return alwaysVisible || isPastScrollThreshold;
}

export function shouldMountBackToTopButton(shouldShow: boolean): boolean {
  return shouldShow;
}
