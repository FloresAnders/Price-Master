import { FirestoreService } from "./firestore";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";

export const normalizeSolicitudEmpresaKey = (empresa: string) =>
  String(empresa || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const sortByCreatedAtDesc = (rows: any[]) =>
  [...rows].sort((a, b) => {
    const getTime = (value: any) => {
      if (!value) return 0;
      if (typeof value?.seconds === "number") return value.seconds * 1000;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return getTime(b?.createdAt) - getTime(a?.createdAt);
  });

export class SolicitudesService {
  private static readonly COLLECTION_NAME = "solicitudes";

  /**
   * Delete multiple solicitudes by IDs efficiently (chunks to respect Firestore batch limits).
   */
  static async deleteSolicitudesByIds(ids: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (uniqueIds.length === 0) return;

    // Firestore writeBatch supports up to 500 ops; keep a safety margin.
    const CHUNK_SIZE = 450;
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const slice = uniqueIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const id of slice) {
        batch.delete(doc(db, this.COLLECTION_NAME, id));
      }
      await batch.commit();
    }
  }

  /**
   * Create a new solicitud document. The service will add the creation date automatically.
   */
  static async addSolicitud(payload: {
    productName: string;
    empresa: string;
  }): Promise<string> {
    const doc = {
      productName: payload.productName,
      empresa: payload.empresa,
      empresaKey: normalizeSolicitudEmpresaKey(payload.empresa),
      createdAt: new Date(),
      listo: false,
    };

    return await FirestoreService.add(this.COLLECTION_NAME, doc);
  }

  /**
   * Update a solicitud document by id with partial data
   */
  static async updateSolicitud(
    id: string,
    data: Partial<Record<string, any>>,
  ): Promise<void> {
    try {
      const patch = { ...data };
      if (typeof patch.empresa === "string") {
        patch.empresaKey = normalizeSolicitudEmpresaKey(patch.empresa);
      }
      await FirestoreService.update(this.COLLECTION_NAME, id, patch);
    } catch (err) {
      console.error("Error updating solicitud", id, err);
      throw err;
    }
  }

  /**
   * Convenience to set the 'listo' flag
   */
  static async setListo(id: string, listo: boolean): Promise<void> {
    return await this.updateSolicitud(id, { listo });
  }

  /**
   * Get all solicitudes ordered by newest first
   */
  static async getAllSolicitudes(): Promise<any[]> {
    // Use query helper to order by createdAt desc
    try {
      const rows = await FirestoreService.query(
        this.COLLECTION_NAME,
        [],
        "createdAt",
        "desc",
      );
      return rows;
    } catch (err) {
      console.error("Error fetching solicitudes:", err);
      return [];
    }
  }

  /**
   * Get solicitudes filtered by empresa (company name)
   */
  static async getSolicitudesByEmpresa(
    empresa: string,
    limitCount?: number,
  ): Promise<any[]> {
    if (!empresa) return [];
    try {
      const conditions = [{ field: "empresa", operator: "==", value: empresa }];
      const rows = await FirestoreService.query(
        this.COLLECTION_NAME,
        conditions,
        "createdAt",
        "desc",
        limitCount,
      );
      if (rows && rows.length > 0) return rows;

      // In production, avoid expensive fallbacks that read the entire collection.
      // These fallbacks were intended for dev/debugging when company names are inconsistent.
      if (process.env.NODE_ENV === "production") {
        return [];
      }

      // If no rows found, fallback: fetch all and perform a normalized client-side match.
      // This handles differences in casing, extra spaces, or small variants in stored company names.
      const all = await FirestoreService.getAll(this.COLLECTION_NAME);
      const normalize = (s: any) =>
        (s || "")
          .toString()
          .normalize("NFKD")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const target = normalize(empresa);
      const exact = all.filter((r) => normalize(r.empresa) === target);
      if (exact.length > 0) {
        // sort by createdAt desc
        return exact.sort((a, b) => {
          const dateA = a?.createdAt
            ? a.createdAt.seconds
              ? new Date(a.createdAt.seconds * 1000)
              : new Date(a.createdAt)
            : new Date(0);
          const dateB = b?.createdAt
            ? b.createdAt.seconds
              ? new Date(b.createdAt.seconds * 1000)
              : new Date(b.createdAt)
            : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      }

      // Fallback partial match (contains)
      const partial = all.filter((r) => normalize(r.empresa).includes(target));
      if (partial.length > 0) {
        return partial.sort((a, b) => {
          const dateA = a?.createdAt
            ? a.createdAt.seconds
              ? new Date(a.createdAt.seconds * 1000)
              : new Date(a.createdAt)
            : new Date(0);
          const dateB = b?.createdAt
            ? b.createdAt.seconds
              ? new Date(b.createdAt.seconds * 1000)
              : new Date(b.createdAt)
            : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      }

      return [];
    } catch (err) {
      console.error("Error fetching solicitudes for empresa", empresa, err);
      return [];
    }
  }

  static async getPendingSolicitudesByEmpresa(
    empresa: string,
    limitCount = 200,
  ): Promise<any[]> {
    const empresaKey = normalizeSolicitudEmpresaKey(empresa);
    if (!empresaKey) return [];

    try {
      const byKey = await FirestoreService.query(
        this.COLLECTION_NAME,
        [{ field: "empresaKey", operator: "==", value: empresaKey }],
        "createdAt",
        "desc",
        limitCount,
      );
      const exact = await this.getSolicitudesByEmpresa(empresa, limitCount);
      const merged = new Map<string, any>();
      [...byKey, ...exact].forEach((row) => {
        if (row?.id) merged.set(row.id, row);
      });
      return sortByCreatedAtDesc(
        Array.from(merged.values()).filter((row) => !row?.listo),
      ).slice(0, limitCount);
    } catch (err) {
      console.error("Error fetching pending solicitudes for empresa", empresa, err);
      return [];
    }
  }

  static subscribePendingSolicitudesByEmpresa(
    empresa: string,
    onRows: (rows: any[]) => void,
    onError?: (error: unknown) => void,
    limitCount = 50,
  ): Unsubscribe {
    const empresaKey = normalizeSolicitudEmpresaKey(empresa);
    if (!empresaKey) {
      onRows([]);
      return () => {};
    }

    const expectedSources = new Set(["empresaKey", "empresa"]);
    const initializedSources = new Set<string>();
    const rowsBySource = new Map<string, Map<string, any>>();
    const emit = () => {
      if (initializedSources.size < expectedSources.size) return;
      const merged = new Map<string, any>();
      rowsBySource.forEach((sourceRows) => {
        sourceRows.forEach((row, id) => merged.set(id, row));
      });
      onRows(
        sortByCreatedAtDesc(
          Array.from(merged.values()).filter((row) => !row?.listo),
        ).slice(0, limitCount),
      );
    };

    const subscribe = (
      source: string,
      field: "empresa" | "empresaKey",
      value: string,
    ) =>
      onSnapshot(
        query(
          collection(db, this.COLLECTION_NAME),
          where(field, "==", value),
          orderBy("createdAt", "desc"),
          limit(limitCount),
        ),
        (snapshot) => {
          initializedSources.add(source);
          rowsBySource.set(
            source,
            new Map(
              snapshot.docs.map((item) => [
                item.id,
                { id: item.id, ...item.data() },
              ]),
            ),
          );
          emit();
        },
        (error) => {
          console.error("onSnapshot error for solicitudes:", error);
          onError?.(error);
        },
      );

    const unsubscribers = [
      subscribe("empresaKey", "empresaKey", empresaKey),
      subscribe("empresa", "empresa", empresa),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  /**
   * Delete a solicitud by id
   */
  static async deleteSolicitud(id: string): Promise<void> {
    return await FirestoreService.delete(this.COLLECTION_NAME, id);
  }
}
