import { FirestoreService } from './firestore';
import { Empresa } from '../types/firestore';
import { UsersService } from './users';

export class EmpresasService {
  private static readonly COLLECTION_NAME = 'empresa';

  static async getAllEmpresas(): Promise<Empresa[]> {
    return await FirestoreService.getAll(this.COLLECTION_NAME);
  }

  /**
   * Add a new empresa. If empresa.id is provided, create with that id.
   */
  static async addEmpresa(empresa: Partial<Empresa> & { id?: string }): Promise<string> {
    // If an ownerId is provided, enforce owner's maxCompanies limit (if any)
    const ownerId = empresa.ownerId || '';
    if (ownerId) {
      try {
        const owner = await UsersService.getUserById(ownerId);
        if (owner && typeof owner.maxCompanies === 'number') {
          // Count existing empresas for this owner
          const existing = await FirestoreService.query(this.COLLECTION_NAME, [
            { field: 'ownerId', operator: '==', value: ownerId }
          ]);
          const currentCount = existing.length;
          if (currentCount >= owner.maxCompanies) {
            throw new Error(`El dueño de tu empresa ha alcanzado el máximo de empresas permitidas, max: (${owner.maxCompanies})`);
          }
        }
      } catch (err) {
        // If query for owner fails, surface the error
        if (err instanceof Error) throw err;
        throw new Error('Failed to validate owner maxCompanies');
      }
    }
    if (empresa.id) {
      // Use provided id
      await FirestoreService.addWithId(this.COLLECTION_NAME, empresa.id, {
        ownerId: empresa.ownerId || '',
        name: empresa.name || '',
        ubicacion: empresa.ubicacion || '',
        empleados: empresa.empleados || []
      });
      return empresa.id;
    }

    return await FirestoreService.add(this.COLLECTION_NAME, {
      ownerId: empresa.ownerId || '',
      name: empresa.name || '',
      ubicacion: empresa.ubicacion || '',
      empleados: empresa.empleados || []
    });
  }

  static async updateEmpresa(id: string, empresa: Partial<Empresa>): Promise<void> {
    return await FirestoreService.update(this.COLLECTION_NAME, id, empresa);
  }

  static async deleteEmpresa(id: string): Promise<void> {
    return await FirestoreService.delete(this.COLLECTION_NAME, id);
  }
}
