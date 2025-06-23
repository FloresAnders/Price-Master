// Types para BarcodeScanner y ScanHistory

export interface QuaggaResultObject {
  codeResult?: {
    code: string | null;
  };
}

export interface BarcodeScannerProps {
  onDetect?: (code: string, productName?: string) => void;
}

export interface ScanHistoryEntry {
  code: string;
  name?: string;
}
export interface ScanHistoryProps {
  history: ScanHistoryEntry[];
  onCopy?: (code: string) => void;
  onDelete?: (code: string) => void;
  onRemoveLeadingZero?: (code: string) => void;
  onRename?: (code: string, name: string) => void;
}
