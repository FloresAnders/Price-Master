import { FirestoreService } from './firestore';

export class SolicitudesService {
  private static readonly COLLECTION_NAME = 'solicitudes';

  /**
   * Create a new solicitud document. The service will add the creation date automatically.
   */
  static async addSolicitud(payload: { productName: string; empresa: string }): Promise<string> {
    const doc = {
      productName: payload.productName,
      empresa: payload.empresa,
      createdAt: new Date(),
    };

    return await FirestoreService.add(this.COLLECTION_NAME, doc);
  }

  /**
   * Get all solicitudes ordered by newest first
   */
  static async getAllSolicitudes(): Promise<any[]> {
    // Use query helper to order by createdAt desc
    try {
      const rows = await FirestoreService.query(this.COLLECTION_NAME, [], 'createdAt', 'desc');
      return rows;
    } catch (err) {
      console.error('Error fetching solicitudes:', err);
      return [];
    }
  }

  /**
   * Get solicitudes filtered by empresa (company name)
   */
  static async getSolicitudesByEmpresa(empresa: string): Promise<any[]> {
    if (!empresa) return [];
    try {
      const conditions = [
        { field: 'empresa', operator: '==', value: empresa }
      ];
      const rows = await FirestoreService.query(this.COLLECTION_NAME, conditions, 'createdAt', 'desc');
      if (rows && rows.length > 0) return rows;

      // If no rows found, fallback: fetch all and perform a normalized client-side match.
      // This handles differences in casing, extra spaces, or small variants in stored company names.
      const all = await FirestoreService.getAll(this.COLLECTION_NAME);
      const normalize = (s: any) => (s || '')
        .toString()
        .normalize('NFKD')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      const target = normalize(empresa);
      const exact = all.filter(r => normalize(r.empresa) === target);
      if (exact.length > 0) {
        // sort by createdAt desc
        return exact.sort((a, b) => {
          const da = a?.createdAt ? (a.createdAt.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt)) : new Date(0);
          const db = b?.createdAt ? (b.createdAt.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt)) : new Date(0);
          return db.getTime() - da.getTime();
        });
      }

      // Fallback partial match (contains)
      const partial = all.filter(r => normalize(r.empresa).includes(target));
      if (partial.length > 0) {
        return partial.sort((a, b) => {
          const da = a?.createdAt ? (a.createdAt.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt)) : new Date(0);
          const db = b?.createdAt ? (b.createdAt.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt)) : new Date(0);
          return db.getTime() - da.getTime();
        });
      }

      return [];
    } catch (err) {
      console.error('Error fetching solicitudes for empresa', empresa, err);
      return [];
    }
  }

  /**
   * Delete a solicitud by id
   */
  static async deleteSolicitud(id: string): Promise<void> {
    return await FirestoreService.delete(this.COLLECTION_NAME, id);
  }
}
