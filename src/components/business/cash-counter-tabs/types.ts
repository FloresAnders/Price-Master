export type BillsMap = Record<number, number>;

export type CashCounterData = {
  name: string;
  bills: BillsMap;
  extraAmount: number;
  currency: "CRC" | "USD";
  aperturaCaja: number;
  ventaActual: number;
};

export interface CashCounterProps {
  id: number;
  data: CashCounterData;
  showBD: boolean;
  onUpdate: (i: number, d: CashCounterData) => void;
}

export interface CounterSidebarProps {
  data: CashCounterData[];
  active: number;
  onSelect: (i: number) => void;
  onRename: (i: number) => void;
  onAdd: () => void;
  dragIdx: number | null;
  overIdx: number | null;
  onDragStart: (e: React.DragEvent, i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
}

export interface RightPanelProps {
  data: CashCounterData;
  showExtra: boolean;
  setShowExtra: (v: boolean) => void;
  showBD: boolean;
  setShowBD: (v: boolean) => void;
  onUpdate: (d: CashCounterData) => void;
  onCurrencyOpen: () => void;
  onDelete: () => void;
}
