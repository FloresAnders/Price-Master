import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import crypto from "crypto";

type EmailChangeCodeRecord = {
  codeHash: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
};

export class EmailChangeCodeService {
  private static readonly COLLECTION = "email_change_codes";
  private static readonly CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutos

  private static generateCode(): string {
    // 6 dígitos
    const code = crypto.randomInt(0, 1_000_000);
    return String(code).padStart(6, "0");
  }

  private static hashCode(code: string): string {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  private static async invalidatePreviousCodes(userId: string): Promise<void> {
    const codesRef = collection(db, this.COLLECTION);
    const q = query(codesRef, where("userId", "==", userId));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  static async createCode(
    userId: string,
  ): Promise<{ code: string; expiresAt: number }> {
    const code = this.generateCode();
    const codeHash = this.hashCode(code);

    const now = Date.now();
    const expiresAt = now + this.CODE_EXPIRY_MS;

    await this.invalidatePreviousCodes(userId);

    const record: EmailChangeCodeRecord = {
      codeHash,
      userId,
      createdAt: now,
      expiresAt,
    };

    const ref = doc(collection(db, this.COLLECTION));
    await setDoc(ref, record);

    await this.logSecurityEvent("email_change_code_requested", {
      userId,
      timestamp: now,
    });

    return { code, expiresAt };
  }

  static async validateCode(params: {
    userId: string;
    code: string;
  }): Promise<{ valid: boolean; error?: string }> {
    const codeHash = this.hashCode(params.code);

    const codesRef = collection(db, this.COLLECTION);
    const q = query(
      codesRef,
      where("userId", "==", params.userId),
      where("codeHash", "==", codeHash),
    );

    const snap = await getDocs(q);
    if (snap.empty) return { valid: false, error: "Código inválido" };

    const docSnap = snap.docs[0];
    const record = docSnap.data() as EmailChangeCodeRecord;

    if (Date.now() > record.expiresAt) {
      await deleteDoc(docSnap.ref);
      return { valid: false, error: "Código expirado" };
    }

    return { valid: true };
  }

  static async consumeCode(params: {
    userId: string;
    code: string;
  }): Promise<void> {
    const codeHash = this.hashCode(params.code);

    const codesRef = collection(db, this.COLLECTION);
    const q = query(
      codesRef,
      where("userId", "==", params.userId),
      where("codeHash", "==", codeHash),
    );

    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));

    await this.logSecurityEvent("email_change_code_consumed", {
      userId: params.userId,
      timestamp: Date.now(),
    });
  }

  private static async logSecurityEvent(
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const logRef = doc(collection(db, "security_logs"));
      await setDoc(logRef, {
        type,
        ...payload,
      });
    } catch {
      // Best-effort; do not block flow.
    }
  }
}
