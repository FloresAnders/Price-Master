export interface RecoveryToken {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  userId: string;
}

export interface RecoveryRequest {
  email: string;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface PasswordResetPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}
