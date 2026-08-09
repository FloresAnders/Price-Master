import type { Timestamp } from 'firebase-admin/firestore';

export type DeviceLinkStatus =
  | 'pending'
  | 'scanned'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'used';

export interface DeviceLinkRequest {
  id: string;
  userId: string;
  status: DeviceLinkStatus;
  tokenHash: string;
  createdAt: Timestamp | string | number;
  qrExpiresAt: Timestamp | string | number;
  requestedAccessMinutes: number;
  permissions?: string[];
  requestedDevice?: Record<string, any>;
  scannedAt?: Timestamp | string | number;
  approvedAt?: Timestamp | string | number;
  approvedBy?: string;
  rejectedAt?: Timestamp | string | number;
  consumedAt?: Timestamp | string | number;
}

export interface DeviceSession {
  id: string;
  userId: string;
  sessionTokenHash: string;
  deviceType?: string;
  deviceName?: string;
  browser?: string;
  os?: string;
  userAgent?: string;
  createdAt: Timestamp | string | number;
  expiresAt: Timestamp | string | number;
  revokedAt?: Timestamp | string | number;
  authorizedBy: string;
  deviceLinkRequestId: string;
  permissions?: string[];
}
