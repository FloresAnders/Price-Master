import { FirestoreService } from "./firestore";
import { Sorteo } from "../types/firestore";

export class SorteosService {
  private static readonly COLLECTION_NAME = "sorteos";

  /**
   * Get all sorteos.
   *
   * Callers (dropdowns, export, DataEditor, migration) rely on the complete
   * set, so `limitCount` stays optional and defaults to no limit to preserve the
   * current result.
   */
  static async getAllSorteos(options?: {
    limitCount?: number;
  }): Promise<Sorteo[]> {
    const limitCount =
      typeof options?.limitCount === "number" &&
      Number.isFinite(options.limitCount) &&
      options.limitCount > 0
        ? Math.trunc(options.limitCount)
        : undefined;
    return await FirestoreService.getAll(this.COLLECTION_NAME, limitCount);
  }

  /**
   * Get sorteo by ID
   */
  static async getSorteoById(id: string): Promise<Sorteo | null> {
    return await FirestoreService.getById(this.COLLECTION_NAME, id);
  }

  /**
   * Add a new sorteo
   */
  static async addSorteo(sorteo: Omit<Sorteo, "id">): Promise<string> {
    return await FirestoreService.add(this.COLLECTION_NAME, sorteo);
  }

  /**
   * Update a sorteo
   */
  static async updateSorteo(
    id: string,
    sorteo: Partial<Sorteo>,
  ): Promise<void> {
    return await FirestoreService.update(this.COLLECTION_NAME, id, sorteo);
  }

  /**
   * Delete a sorteo
   */
  static async deleteSorteo(id: string): Promise<void> {
    return await FirestoreService.delete(this.COLLECTION_NAME, id);
  }

  /**
   * Find sorteos by name (partial match)
   */
  static async findSorteosByName(name: string): Promise<Sorteo[]> {
    const allSorteos = await this.getAllSorteos();
    return allSorteos.filter((sorteo) =>
      sorteo.name.toLowerCase().includes(name.toLowerCase()),
    );
  }

  /**
   * Get sorteos ordered by name
   */
  static async getSorteosOrderedByName(options?: {
    limitCount?: number;
  }): Promise<Sorteo[]> {
    const limitCount =
      typeof options?.limitCount === "number" &&
      Number.isFinite(options.limitCount) &&
      options.limitCount > 0
        ? Math.trunc(options.limitCount)
        : undefined;
    return await FirestoreService.query(
      this.COLLECTION_NAME,
      [],
      "name",
      "asc",
      limitCount,
    );
  }

  /**
   * Search sorteos that contain specific text
   */
  static async searchSorteos(searchTerm: string): Promise<Sorteo[]> {
    const allSorteos = await this.getAllSorteos();
    return allSorteos.filter((sorteo) =>
      sorteo.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }
}
