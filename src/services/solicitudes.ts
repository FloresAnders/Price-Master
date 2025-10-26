import { FirestoreService } from './firestore';

export class SolicitudesService {
  private static readonly COLLECTION_NAME = 'solicitudes';

  /**
   * Create a new solicitud document. The service will add the creation date automatically.
   */
  static async addSolicitud(payload: { productName: string; empresa: string; createdBy?: string }): Promise<string> {
    const doc = {
      productName: payload.productName,
      empresa: payload.empresa,
      createdAt: new Date(),
      createdBy: payload.createdBy || ''
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
   * Delete a solicitud by id
   */
  static async deleteSolicitud(id: string): Promise<void> {
    return await FirestoreService.delete(this.COLLECTION_NAME, id);
  }
}
