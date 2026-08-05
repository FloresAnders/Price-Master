type SortableFloatingAction = {
  label: string;
  order: number;
  visible?: boolean;
};

export function sortVisibleFloatingActions<T extends SortableFloatingAction>(
  actionsById: Record<string, T>,
): T[] {
  return Object.values(actionsById)
    .filter((action) => action.visible !== false)
    .sort(
      (left, right) =>
        left.order - right.order || left.label.localeCompare(right.label, "es"),
    );
}

export function shouldRenderFloatingActionsDock(
  actions: readonly unknown[],
  suppressed: boolean,
): boolean {
  return !suppressed && actions.length > 0;
}

export function getFloatingActionsDockBottomOffsetPx(
  backToTopVisible: boolean,
): number {
  return backToTopVisible ? 92 : 20;
}
